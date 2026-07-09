"use client"

import Link from "next/link"
import { MessageCircle } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useConversations } from "@/hooks/use-direct-messages"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

function formatWhen(iso: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short" })
}

export default function MessagesPage() {
  const { data: conversations, isPending } = useConversations()

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6 pb-20">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Messages</h1>
          <p className="text-sm text-text-muted">Direct conversations with your friends.</p>
        </div>

        {isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="space-y-1">
            {conversations.map((c) => (
              <Link
                key={c.conversationId}
                href={`/messages/${c.otherUser.id}`}
                className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted"
              >
                <Avatar>
                  {c.otherUser.avatarUrl && <AvatarImage src={c.otherUser.avatarUrl} alt={c.otherUser.fullName} />}
                  <AvatarFallback>{initials(c.otherUser.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate font-medium text-foreground">{c.otherUser.fullName}</p>
                    <span className="shrink-0 text-xs text-text-muted">{formatWhen(c.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-sm text-text-muted">{c.lastMessage ?? "No messages yet"}</p>
                </div>
                {c.unreadCount > 0 && <Badge>{c.unreadCount}</Badge>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
              <MessageCircle className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">No conversations yet</p>
              <p className="mt-0.5 text-sm text-text-muted">
                Message a friend from your <Link href="/friends" className="text-primary hover:underline">friends list</Link>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
