"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useGroupSchedule, usePayContribution } from "@/hooks/use-contributions"
import { useAuth } from "@/providers/auth-provider"
import { toast } from "sonner"
import type { ContributionStatus } from "@/lib/types"

const statusVariant: Record<ContributionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "secondary",
  pending: "outline",
  late: "destructive",
  defaulted: "destructive",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}

export function GroupSchedulePanel({ groupId }: { groupId: string }) {
  const { data: rounds, isPending } = useGroupSchedule(groupId)
  const payContribution = usePayContribution(groupId)
  const { user } = useAuth()

  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!rounds || rounds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card py-10 text-center">
        <p className="font-medium text-foreground">No schedule yet</p>
        <p className="mt-0.5 text-sm text-text-muted">The round schedule appears once the group activates.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <div
          key={round.id}
          className={`rounded-xl border p-4 ${
            round.status === "active" ? "border-primary/40 bg-primary-soft/30" : "border-border bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Round {round.number}</p>
              <p className="text-xs text-text-muted">
                Payout to <span className="font-medium">{round.payoutMemberName}</span>
              </p>
            </div>
            <Badge variant={round.status === "active" ? "default" : round.status === "completed" ? "secondary" : "outline"}>
              {round.status}
            </Badge>
          </div>

          <p className="mt-1 text-xs text-text-muted">
            {formatDate(round.startDate)} → {formatDate(round.endDate)}
            {round.payoutReleasedAt && ` · Payout released ${formatDate(round.payoutReleasedAt)}`}
          </p>

          <div className="mt-3 space-y-1.5">
            {round.contributions.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {c.fullName}
                  {c.userId === user?.id && <span className="ml-1 text-xs text-primary">(you)</span>}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">₦{c.amount.toLocaleString("en-NG")}</span>
                  <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
                </div>
              </div>
            ))}
          </div>

          {round.status === "active" &&
            (() => {
              const mine = round.contributions.find(
                (c) => c.userId === user?.id && (c.status === "pending" || c.status === "late"),
              )
              if (!mine) return null
              return (
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={payContribution.isPending}
                  onClick={() =>
                    payContribution.mutate(mine.id, {
                      onSuccess: () => toast.success("Contribution paid!"),
                      onError: (err) => toast.error(err.message),
                    })
                  }
                >
                  {payContribution.isPending ? "Paying…" : `Pay my contribution (₦${mine.amount.toLocaleString("en-NG")})`}
                </Button>
              )
            })()}
        </div>
      ))}
    </div>
  )
}
