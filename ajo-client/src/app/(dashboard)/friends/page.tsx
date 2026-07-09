"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { MessageCircle, Users } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFriends } from "@/hooks/use-friends"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export default function FriendsPage() {
  const { data: friends, isPending } = useFriends()
  const router = useRouter()

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6 pb-20">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Friends</h1>
          <p className="text-sm text-text-muted">People you've shared an Ajo circle with.</p>
        </div>

        {isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : friends && friends.length > 0 ? (
          <div className="space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Avatar>
                  {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} alt={friend.fullName} />}
                  <AvatarFallback>{initials(friend.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{friend.fullName}</p>
                  <p className="text-xs text-text-muted">Reputation {friend.reputationScore}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => router.push(`/messages/${friend.userId}`)}>
                  <MessageCircle className="size-3.5" />
                  Message
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">No friends yet</p>
              <p className="mt-0.5 text-sm text-text-muted">
                Join an Ajo circle — you'll automatically connect with everyone in it.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/groups">Browse circles</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
