"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Copy, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { GroupMembersPanel } from "@/components/ajo/group-members-panel"
import { GroupSchedulePanel } from "@/components/ajo/group-schedule-panel"
import { GroupChatPanel } from "@/components/ajo/group-chat-panel"
import {
  useGroupDetail,
  useJoinRequests,
  useReviewJoinRequest,
  useActivateGroup,
  useLeaveGroup,
} from "@/hooks/use-groups"

function formatFrequency(freq: string) {
  return freq === "testing" ? "Every 3 minutes (dev)" : freq.charAt(0).toUpperCase() + freq.slice(1)
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params)
  const router = useRouter()
  const { data: group, isPending } = useGroupDetail(groupId)
  const activateGroup = useActivateGroup(groupId)
  const leaveGroup = useLeaveGroup()
  const [copied, setCopied] = useState(false)

  if (isPending) {
    return (
      <div className="p-4 pt-6 lg:p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="p-4 pt-6 lg:p-8 text-center text-text-muted">
        Circle not found, or you don't have access to it.
      </div>
    )
  }

  const isAdmin = group.myRole === "admin"
  const inviteLink = group.inviteCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/groups/join?code=${group.inviteCode}`
    : null

  function copyInviteLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success("Invite link copied")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-5 pb-20">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to groups
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{group.name}</h1>
              <Badge variant={group.status === "active" ? "default" : group.status === "completed" ? "secondary" : "outline"}>
                {group.status}
              </Badge>
            </div>
            {group.description && <p className="mt-1 text-sm text-text-muted">{group.description}</p>}
            <p className="mt-1 text-sm text-text-muted">
              ₦{group.memberShare.toLocaleString("en-NG")} per member · {formatFrequency(group.frequency)} · {group.memberCount}/{group.cycleLength} members
            </p>
          </div>
        </div>

        {/* Admin: invite link + activation */}
        {isAdmin && group.status === "pending" && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {group.visibility === "private" && inviteLink && (
              <div>
                <p className="text-sm font-medium text-foreground">Invite link</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{inviteLink}</code>
                  <Button size="icon" variant="outline" onClick={copyInviteLink}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
            )}

            {group.visibility === "public" && <JoinRequestsPanel groupId={groupId} />}

            {group.activationMode === "manual_start_by_admin" && (
              <Button
                onClick={() =>
                  activateGroup.mutate(undefined, {
                    onSuccess: () => toast.success("Circle started! Round 1 has begun."),
                    onError: (err) => toast.error(err.message),
                  })
                }
                disabled={activateGroup.isPending || group.memberCount < 2}
              >
                {activateGroup.isPending
                  ? "Starting…"
                  : group.memberCount < 2
                  ? "Need at least 2 members"
                  : "Start circle now"}
              </Button>
            )}
          </div>
        )}

        {/* Leave (pre-activation only) */}
        {group.status === "pending" && !isAdmin && group.myRole && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              leaveGroup.mutate(groupId, {
                onSuccess: () => {
                  toast.success("You left the circle")
                  router.push("/groups")
                },
                onError: (err) => toast.error(err.message),
              })
            }
          >
            Leave circle
          </Button>
        )}

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <GroupMembersPanel group={group} />
          </TabsContent>

          <TabsContent value="schedule">
            <GroupSchedulePanel groupId={groupId} />
          </TabsContent>

          <TabsContent value="chat">
            <GroupChatPanel groupId={groupId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function JoinRequestsPanel({ groupId }: { groupId: string }) {
  const { data: requests, isPending } = useJoinRequests(groupId)
  const review = useReviewJoinRequest(groupId)

  if (isPending) return <Skeleton className="h-16 w-full rounded-xl" />
  if (!requests || requests.length === 0) return null

  return (
    <div>
      <p className="text-sm font-medium text-foreground">Pending join requests ({requests.length})</p>
      <div className="mt-2 space-y-2">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted p-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{req.fullName}</p>
              {req.message && <p className="truncate text-xs text-text-muted">{req.message}</p>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="xs"
                onClick={() => review.mutate({ requestId: req.id, decision: "APPROVE" })}
                disabled={review.isPending}
              >
                Approve
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => review.mutate({ requestId: req.id, decision: "REJECT" })}
                disabled={review.isPending}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
