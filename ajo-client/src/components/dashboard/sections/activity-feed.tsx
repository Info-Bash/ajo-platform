"use client"

import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  RefreshCw,
} from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { useTransactions } from "@/hooks/use-wallet"
import { cn } from "@/lib/utils"
import type { Transaction, TransactionType } from "@/lib/types"

const TYPE_CONFIG: Record<
  TransactionType,
  { icon: React.ElementType; label: string; positive: boolean }
> = {
  deposit:       { icon: ArrowDownLeft,   label: "Deposit",      positive: true  },
  withdrawal:    { icon: ArrowUpRight,    label: "Withdrawal",   positive: false },
  transfer_in:   { icon: ArrowDownLeft,   label: "Received",     positive: true  },
  transfer_out:  { icon: ArrowUpRight,    label: "Sent",         positive: false },
  contribution:  { icon: Wallet,          label: "Contribution", positive: false },
  payout:        { icon: TrendingUp,      label: "Payout",       positive: true  },
  reversal:      { icon: RefreshCw,       label: "Reversal",     positive: true  },
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const config = TYPE_CONFIG[tx.type]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          config.positive ? "bg-status-paid-bg" : "bg-bg-muted"
        )}
      >
        <Icon
          className={cn(
            "size-4",
            config.positive ? "text-status-paid-text" : "text-text-secondary"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {tx.description}
        </p>
        <p className="text-xs text-text-muted">
          {config.label}
          {tx.groupName ? ` · ${tx.groupName}` : ""}
          {tx.status === "pending" ? " · Pending" : ""}
          {tx.status === "failed" ? " · Failed" : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            config.positive ? "text-status-paid" : "text-foreground"
          )}
        >
          {config.positive ? "+" : "-"}{formatNaira(tx.amount)}
        </p>
        <p className="text-xs text-text-muted">{relativeTime(tx.createdAt)}</p>
      </div>
    </div>
  )
}

export function ActivityFeed() {
  const { data, isPending, isError } = useTransactions({ limit: 5 })

  if (isPending) return <ActivityFeedSkeleton />

  const transactions = data?.transactions ?? []

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
        <Link
          href="/wallet"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-8 text-center">
          <RefreshCw className="size-5 text-text-muted" />
          <p className="text-sm text-text-muted">Couldn&apos;t load activity</p>
        </div>
      ) : transactions.length > 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-8 text-center">
          <RefreshCw className="size-5 text-text-muted" />
          <p className="text-sm text-text-muted">No activity yet</p>
        </div>
      )}
    </section>
  )
}

export function ActivityFeedSkeleton() {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <div className="text-right">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-1 h-3 w-12 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}