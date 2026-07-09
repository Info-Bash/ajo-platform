"use client"

import { use, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useDirectMessages,
  useSendDirectMessage,
  useRealtimeDirectMessages,
} from "@/hooks/use-direct-messages"
import { useFriends } from "@/hooks/use-friends"
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

export default function DirectMessageThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: otherUserId } = use(params)
  const { user } = useAuth()
  const { data, isPending } = useDirectMessages(otherUserId)
  const sendMessage = useSendDirectMessage(otherUserId)
  const { data: friends } = useFriends()
  useRealtimeDirectMessages(otherUserId)

  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const friend = friends?.find((f) => f.userId === otherUserId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [data?.messages.length])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    setError(null)
    setContent("")
    sendMessage.mutate(trimmed, { onError: (err) => setError(err.message) })
  }

  return (
    // Height = viewport minus the fixed topbar (3.5rem) minus the fixed
    // mobile bottom tab bar (4rem, hidden on lg+). Getting this wrong is
    // what caused the input to end up hidden behind the bottom bar and the
    // whole page to scroll instead of just the message list — see the
    // min-h-0 chain below for why the inner scroll area needs it too.
    <div className="flex h-[calc(100dvh-3.5rem-4rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      <div className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col">
        {/* Header — fixed size, stays put */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 lg:px-8">
          <Link
            href="/messages"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="font-semibold text-foreground">{friend?.fullName ?? "Conversation"}</h1>
        </div>

        {/* Messages — the only scrollable region */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 lg:px-8">
          {isPending ? (
            <ChatSkeleton />
          ) : (
            data?.messages.map((message) => (
              <div key={message.id} className={`flex ${message.senderId === user?.id ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    message.senderId === user?.id
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground"
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="mt-0.5 text-right text-[10px] opacity-60">{formatTime(message.createdAt)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input — fixed size, stays put */}
        <div className="shrink-0 border-t border-border px-4 py-3 lg:px-8">
          {error && <p className="mb-2 text-sm text-destructive" role="alert">{error}</p>}
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              placeholder="Type a message…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!content.trim() || sendMessage.isPending}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
