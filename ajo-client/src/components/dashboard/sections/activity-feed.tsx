"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { useTransactions } from "@/hooks/use-wallet"
import { TransactionRow } from "@/components/wallet/transaction-row"

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