"use client"

import { AlertTriangle, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"

import { useDashboard } from "@/hooks/use-dashboard"
import { cn } from "@/lib/utils"

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function ContributionAlert() {
  const { data } = useDashboard()

  if (!data?.nextContribution) return null

  const { nextContribution } = data
  const isOverdue = nextContribution.daysUntilDue < 0
  const isDueSoon = nextContribution.daysUntilDue <= 2

  if (!isOverdue && !isDueSoon) return null

  const label = isOverdue
    ? `Overdue by ${Math.abs(nextContribution.daysUntilDue)} day${Math.abs(nextContribution.daysUntilDue) === 1 ? "" : "s"}`
    : nextContribution.daysUntilDue === 0
    ? "Due today"
    : `Due in ${nextContribution.daysUntilDue} day${nextContribution.daysUntilDue === 1 ? "" : "s"}`

  return (
    <Link
      href={`/groups/${nextContribution.groupId}`}
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 transition-opacity hover:opacity-90",
        isOverdue
          ? "bg-status-overdue-bg text-status-overdue-text"
          : "bg-status-pending-bg text-status-pending-text"
      )}
    >
      {isOverdue
        ? <AlertTriangle className="size-4 shrink-0" />
        : <Clock className="size-4 shrink-0" />}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {formatNaira(nextContribution.amount)} contribution — {nextContribution.groupName}
        </p>
        <p className="text-xs opacity-80">{label}</p>
      </div>

      <ArrowRight className="size-4 shrink-0 opacity-60" />
    </Link>
  )
}