import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, ApiError } from "@/lib/api-client"
import { queryKeys } from "@/hooks/use-dashboard"
import { useSocket, SOCKET_EVENTS } from "@/providers/socket-provider"
import type { Conversation, DirectMessage } from "@/lib/types"

interface BackendDirectMessage {
  id: string
  conversationId: string
  senderId: string
  senderName?: string
  senderAvatarUrl?: string
  content: string
  createdAt: string
}

function mapMessage(raw: BackendDirectMessage): DirectMessage {
  return { ...raw }
}

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: queryKeys.conversations(),
    queryFn: () => apiClient.get<Conversation[]>("/messages/conversations"),
  })
}

interface DMResult {
  messages: DirectMessage[]
  total: number
  totalPages: number
}

export function useDirectMessages(otherUserId: string, limit = 50) {
  return useQuery<DMResult>({
    queryKey: queryKeys.messages(otherUserId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: BackendDirectMessage[]; meta: { total: number; totalPages: number } }>(
        `/messages/${otherUserId}?limit=${limit}`,
      )
      return { messages: res.data.map(mapMessage), total: res.meta.total, totalPages: res.meta.totalPages }
    },
    enabled: !!otherUserId,
  })
}

export function useSendDirectMessage(otherUserId: string) {
  const queryClient = useQueryClient()
  return useMutation<DirectMessage, ApiError, string>({
    mutationFn: (content) =>
      apiClient.post<BackendDirectMessage>(`/messages/${otherUserId}`, { content }).then(mapMessage),
    onSuccess: (message) => {
      queryClient.setQueryData<DMResult>(queryKeys.messages(otherUserId), (old) =>
        old ? { ...old, messages: [...old.messages, message] } : old,
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations() })
    },
  })
}

/** Keeps an open DM thread live-updated as messages arrive from the socket. */
export function useRealtimeDirectMessages(otherUserId: string) {
  const { on } = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!otherUserId) return

    const off = on(SOCKET_EVENTS.DIRECT_MESSAGE, (data) => {
      const payload = data as BackendDirectMessage
      const isThisThread = payload.senderId === otherUserId
      if (!isThisThread) {
        // Message from/about a different conversation — just refresh the inbox list.
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations() })
        return
      }
      queryClient.setQueryData<DMResult>(queryKeys.messages(otherUserId), (old) => {
        if (!old) return old
        if (old.messages.some((m) => m.id === payload.id)) return old
        return { ...old, messages: [...old.messages, mapMessage(payload)] }
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations() })
    })

    return () => off()
  }, [otherUserId, on, queryClient])
}
