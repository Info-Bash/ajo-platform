"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRemoveMember, useTransferAdmin } from "@/hooks/use-groups"
import { toast } from "sonner"
import type { AjoGroup, MemberStatus } from "@/lib/types"

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

const statusVariant: Record<MemberStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  late: "destructive",
  defaulted: "destructive",
  exited: "outline",
  inactive: "outline",
}

export function GroupMembersPanel({ group }: { group: AjoGroup }) {
  const removeMember = useRemoveMember(group.id)
  const transferAdmin = useTransferAdmin(group.id)
  const isAdmin = group.myRole === "admin"
  const canManage = isAdmin && group.status === "pending"

  return (
    <div className="space-y-2">
      {group.members
        .slice()
        .sort((a, b) => a.payoutOrder - b.payoutOrder)
        .map((member) => (
          <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <Avatar>
              {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.fullName} />}
              <AvatarFallback>{initials(member.fullName)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {member.fullName}
                {member.role === "admin" && <span className="ml-1.5 text-xs text-primary">Admin</span>}
              </p>
              <p className="text-xs text-text-muted">
                Payout round {member.payoutRound}
                {member.hasReceivedPayout && " · Received"}
              </p>
            </div>

            <Badge variant={statusVariant[member.status]}>{member.status}</Badge>

            {canManage && member.role !== "admin" && (
              <div className="flex gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    transferAdmin.mutate(member.userId, {
                      onSuccess: () => toast.success(`${member.fullName} is now admin`),
                      onError: (err) => toast.error(err.message),
                    })
                  }
                >
                  Make admin
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  onClick={() =>
                    removeMember.mutate(member.userId, {
                      onSuccess: () => toast.success(`${member.fullName} removed`),
                      onError: (err) => toast.error(err.message),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
