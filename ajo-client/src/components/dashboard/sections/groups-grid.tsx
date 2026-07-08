"use client"

import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CircleCard } from "@/components/ajo/circle-card"
import { useMyGroups } from "@/hooks/use-groups"
import type { AjoStatus } from "@/components/ajo/status-badge"
import type { AjoGroup } from "@/lib/types"

/** Derives the CircleCard status badge from a group's real lifecycle fields
 *  (no single "myContributionStatus" field exists on the backend — it's
 *  computed per-round via /groups/:id/schedule, so here we approximate from
 *  what the group summary already gives us). */
function deriveAjoStatus(group: AjoGroup): AjoStatus {
  if (group.myStatus === "late" || group.myStatus === "defaulted") return "overdue"
  if (group.status === "completed") return "paid"
  if (
    group.status === "active" &&
    group.myPayoutRound !== null &&
    group.myPayoutRound === group.currentRound &&
    !group.myPayoutReceived
  ) {
    return "turn"
  }
  return "pending"
}

function groupToCircleProps(group: AjoGroup) {
  return {
    id: group.id,
    name: group.name,
    contributionSummary: `₦${(group.memberShare).toLocaleString("en-NG")} / ${group.frequency}`,
    members: group.members.map((m) => ({
      id: m.id,
      name: m.fullName,
      avatarUrl: m.avatarUrl,
    })),
    memberCount: group.memberCount,
    myStatus: deriveAjoStatus(group),
    scheduleNote:
      group.status === "pending"
        ? `${group.memberCount}/${group.cycleLength} members joined`
        : group.nextContributionDate
        ? `Next: ${new Date(group.nextContributionDate).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`
        : "No upcoming contribution",
    progressPercent: Math.round((group.currentRound / group.totalRounds) * 100),
  }
}

export function GroupsGrid() {
  const { data: groups, isPending } = useMyGroups()
  const router = useRouter()

  if (isPending) return <GroupsGridSkeleton />

  const hasGroups = groups && groups.length > 0

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">My Ajo Groups</h2>
        <Link
          href="/groups"
          className="text-xs font-medium text-primary hover:underline"
        >
          See all
        </Link>
      </div>

      {hasGroups ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.slice(0, 4).map((group) => (
              <CircleCard
                key={group.id}
                circle={groupToCircleProps(group)}
                onClick={() => router.push(`/groups/${group.id}`)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
            <Search className="size-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">No circles yet</p>
            <p className="mt-0.5 text-sm text-text-muted">
              Start saving together by creating or joining a circle.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" asChild>
              <Link href="/groups/new">
                <Plus className="size-3.5" />
                Create circle
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/groups/join">Join a circle</Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export function GroupsGridSkeleton() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-24" />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex -space-x-2">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="size-6 rounded-full ring-2 ring-background" />
                ))}
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </section>
  )
}