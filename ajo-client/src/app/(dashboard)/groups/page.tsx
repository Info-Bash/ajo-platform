"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CircleCard } from "@/components/ajo/circle-card"
import { useMyGroups } from "@/hooks/use-groups"
import type { AjoStatus } from "@/components/ajo/status-badge"
import type { AjoGroup } from "@/lib/types"

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

export default function GroupsPage() {
  const { data: groups, isPending } = useMyGroups()
  const router = useRouter()

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">My Ajo circles</h1>
            <p className="text-sm text-text-muted">Everything you're contributing to, in one place.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/groups/discover">
                <Search className="size-3.5" />
                Discover
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/groups/new">
                <Plus className="size-3.5" />
                Create
              </Link>
            </Button>
          </div>
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : groups && groups.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <CircleCard
                key={group.id}
                circle={{
                  id: group.id,
                  name: group.name,
                  contributionSummary: `₦${group.memberShare.toLocaleString("en-NG")} / ${group.frequency}`,
                  members: [],
                  memberCount: group.memberCount,
                  myStatus: deriveAjoStatus(group),
                  scheduleNote:
                    group.status === "pending"
                      ? `${group.memberCount}/${group.cycleLength} joined`
                      : `Round ${group.currentRound}/${group.totalRounds}`,
                  progressPercent: Math.round((group.currentRound / group.totalRounds) * 100),
                }}
                onClick={() => router.push(`/groups/${group.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
              <Search className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">No circles yet</p>
              <p className="mt-0.5 text-sm text-text-muted">Start saving together by creating or joining a circle.</p>
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
      </div>
    </div>
  )
}
