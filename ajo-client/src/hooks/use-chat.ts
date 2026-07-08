import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, ApiError } from "@/lib/api-client"
import { queryKeys } from "@/hooks/use-dashboard"
import { useSocket, SOCKET_EVENTS } from "@/providers/socket-provider"
import type { ChatMessage } from "@/lib/types"

interface BackendChatMessage {
  id: string
  groupId: string
  senderId?: string
  senderName?: string
  senderAvatarUrl?: string
  type: "USER" | "SYSTEM"
  systemEventType?: string
  content: string
  createdAt: string
}

function mapMessage(raw: BackendChatMessage): ChatMessage {
  return {
    id: raw.id,
    groupId: raw.groupId,
    senderId: raw.senderId,
    senderName: raw.senderName,
    senderAvatarUrl: raw.senderAvatarUrl,
    type: raw.type.toLowerCase() as "user" | "system",
    systemEventType: raw.systemEventType,
    content: raw.content,
    createdAt: raw.createdAt,
  }
}

interface ChatMessagesResult {
  messages: ChatMessage[]
  total: number
  totalPages: number
}

export function useGroupMessages(groupId: string, limit = 50) {
  return useQuery<ChatMessagesResult>({
    queryKey: queryKeys.chat(groupId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: BackendChatMessage[]; meta: { total: number; totalPages: number } }>(
        `/chat/groups/${groupId}/messages?limit=${limit}`,
      )
      return { messages: res.data.map(mapMessage), total: res.meta.total, totalPages: res.meta.totalPages }
    },
    enabled: !!groupId,
  })
}

export function useSendGroupMessage(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation<ChatMessage, ApiError, string>({
    mutationFn: (content) =>
      apiClient.post<BackendChatMessage>(`/chat/groups/${groupId}/messages`, { content }).then(mapMessage),
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessagesResult>(queryKeys.chat(groupId), (old) =>
        old ? { ...old, messages: [...old.messages, message] } : old,
      )
    },
  })
}

/**
 * Joins the group's socket room and keeps the chat query cache updated live
 * as USER/SYSTEM messages arrive from other members. Mount once inside the
 * group chat view (e.g. the Chat tab of the group detail page).
 */
export function useRealtimeGroupChat(groupId: string) {
  const { on, emit } = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!groupId) return
    emit("group:join", { groupId })

    function appendIfNew(raw: BackendChatMessage) {
      const message = mapMessage(raw)
      queryClient.setQueryData<ChatMessagesResult>(queryKeys.chat(groupId), (old) => {
        if (!old) return old
        if (old.messages.some((m) => m.id === message.id)) return old // de-dupe (e.g. own message echoed back)
        return { ...old, messages: [...old.messages, message] }
      })
    }

    const offMessage = on(SOCKET_EVENTS.CHAT_MESSAGE, (data) => {
      const payload = data as BackendChatMessage
      if (payload.groupId === groupId) appendIfNew(payload)
    })
    const offSystem = on(SOCKET_EVENTS.CHAT_SYSTEM_MESSAGE, (data) => {
      const payload = data as BackendChatMessage
      if (payload.groupId === groupId) appendIfNew(payload)
    })

    return () => {
      emit("group:leave", { groupId })
      offMessage()
      offSystem()
    }
  }, [groupId, on, emit, queryClient])
}
