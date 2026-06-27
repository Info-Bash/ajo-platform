"use client"

import { Users, TrendingUp, CheckCircle, LogOut } from "lucide-react"
import Link from "next/link"

import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/hooks/use-dashboard"

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function StatsRow() {
  const { data, isPending } = useDashboard()

  if (isPending) return <StatsRowSkeleton />

  const activeGroups  = data?.activeGroupsCount      ?? 0
  const nextPayout    = data?.nextPayout              ?? null
  const completed     = data?.completedGroupsCount    ?? 0
  const exited        = data?.exitedGroupsCount       ?? 0

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Active groups */}
      <Link
        href="/groups"
        className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
      >
        <div className="flex items-center gap-2 text-text-muted">
          <Users className="size-4" />
          <span className="text-xs font-medium">Active Groups</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">{activeGroups}</p>
        <p className="text-xs text-text-muted">ajo circles</p>
      </Link>

      {/* Next payout */}
      <Link
        href="/payouts"
        className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
      >
        <div className="flex items-center gap-2 text-text-muted">
          <TrendingUp className="size-4" />
          <span className="text-xs font-medium">Next Payout</span>
        </div>
        {nextPayout ? (
          <>
            <p className="text-2xl font-semibold text-primary">
              {formatNaira(nextPayout.amount)}
            </p>
            <p className="truncate text-xs text-text-muted">
              Round {nextPayout.round} · {nextPayout.groupName}
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-foreground">—</p>
            <p className="text-xs text-text-muted">No upcoming payout</p>
          </>
        )}
      </Link>

      {/* Completed groups */}
      <Link
        href="/groups?filter=completed"
        className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
      >
        <div className="flex items-center gap-2 text-text-muted">
          <CheckCircle className="size-4" />
          <span className="text-xs font-medium">Completed</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">{completed}</p>
        <p className="text-xs text-text-muted">groups finished</p>
      </Link>

      {/* Exited groups */}
      <Link
        href="/groups?filter=exited"
        className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
      >
        <div className="flex items-center gap-2 text-text-muted">
          <LogOut className="size-4" />
          <span className="text-xs font-medium">Exited</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">{exited}</p>
        <p className="text-xs text-text-muted">groups left</p>
      </Link>
    </div>
  )
}

export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-8 w-16" />
          <Skeleton className="mt-1 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}