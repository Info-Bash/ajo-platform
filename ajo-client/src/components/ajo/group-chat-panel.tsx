"use client"

import { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useGroupMessages, useSendGroupMessage, useRealtimeGroupChat } from "@/hooks/use-chat"
import { useAuth } from "@/providers/auth-provider"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
}

// Alternating bubble widths/sides so the loading state actually reads as a
// conversation rather than a generic list of gray bars.
const SKELETON_BUBBLES = [
  { side: "left", width: "w-2/5" },
  { side: "right", width: "w-1/3" },
  { side: "left", width: "w-1/2" },
  { side: "left", width: "w-1/4" },
  { side: "right", width: "w-2/5" },
] as const

function ChatSkeleton() {
  return (
    <div className="space-y-3">
      {SKELETON_BUBBLES.map((bubble, i) => (
        <div key={i} className={`flex ${bubble.side === "right" ? "justify-end" : "justify-start"}`}>
          <Skeleton className={`h-10 ${bubble.width} rounded-2xl`} />
        </div>
      ))}
    </div>
  )
}

export function GroupChatPanel({ groupId }: { groupId: string }) {
  const { data, isPending } = useGroupMessages(groupId)
  const sendMessage = useSendGroupMessage(groupId)
  useRealtimeGroupChat(groupId)
  const { user } = useAuth()

  const [content, setContent] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [data?.messages.length])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    setContent("")
    sendMessage.mutate(trimmed)
  }

  if (isPending) {
    return <ChatSkeleton />
  }

  return (
    <div className="flex h-[60vh] flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {data?.messages.map((message) =>
          message.type === "system" ? (
            <div key={message.id} className="text-center">
              <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs text-text-muted">
                {message.content}
              </span>
            </div>
          ) : (
            <div
              key={message.id}
              className={`flex ${message.senderId === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  message.senderId === user?.id
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground"
                }`}
              >
                {message.senderId !== user?.id && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">{message.senderName}</p>
                )}
                <p>{message.content}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-60">{formatTime(message.createdAt)}</p>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 flex gap-2 border-t border-border pt-3">
        <Input
          placeholder="Message the group…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!content.trim() || sendMessage.isPending}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
