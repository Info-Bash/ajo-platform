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
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4 pt-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/messages"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="font-semibold text-foreground">{friend?.fullName ?? "Conversation"}</h1>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {isPending ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-2/3 rounded-xl" />)
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

        {error && <p className="mt-2 text-sm text-destructive" role="alert">{error}</p>}

        <form onSubmit={handleSend} className="mt-3 flex gap-2 border-t border-border pt-3">
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
  )
}
