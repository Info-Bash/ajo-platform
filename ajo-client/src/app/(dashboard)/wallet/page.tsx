"use client"

/**
 * Lands here two ways:
 *   1. Normal nav from the dashboard ("View all" / wallet balance link).
 *   2. Nomba's hosted checkout redirects here with ?status=funded after the
 *      user completes payment (see backend WalletService.fundWallet).
 *
 * Important: ?status=funded means the user *finished the checkout flow*, not
 * that the payment necessarily succeeded — the wallet is only actually
 * credited once Nomba's webhook lands on the backend, which happens
 * asynchronously and may arrive a few seconds after this redirect. So on
 * that path we poll briefly for a matching successful deposit before
 * declaring success, instead of trusting the query param alone.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, Loader2, Plus, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useWallet, useTransactions } from "@/hooks/use-wallet"
import { TransactionRow, formatNaira } from "@/components/wallet/transaction-row"
import { cn } from "@/lib/utils"
import type { Transaction } from "@/lib/types"

const CONFIRM_POLL_MS = 2500
const CONFIRM_TIMEOUT_MS = 25_000

function WalletPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Captured once on mount — we clean ?status=funded off the URL right away
  // (so a refresh doesn't replay the banner), but still want the banner
  // itself to persist for the rest of this page visit.
  const [justFunded] = React.useState(() => searchParams.get("status") === "funded")
  const [confirming, setConfirming] = React.useState(justFunded)
  const [confirmed, setConfirmed] = React.useState(false)
  const arrivedAtRef = React.useRef(Date.now())

  React.useEffect(() => {
    if (justFunded) router.replace("/wallet")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wallet = useWallet({ refetchInterval: confirming ? CONFIRM_POLL_MS : false })

  const [page, setPage] = React.useState(1)
  const [items, setItems] = React.useState<Transaction[]>([])
  const transactions = useTransactions({
    page,
    limit: 20,
    refetchInterval: confirming ? CONFIRM_POLL_MS : false,
  })

  // Flatten pages into one list — page 1 replaces (covers the polling
  // refetches too), later pages append via "Load more".
  React.useEffect(() => {
    if (!transactions.data) return
    setItems((prev) =>
      page === 1
        ? transactions.data.transactions
        : [...prev, ...transactions.data.transactions]
    )
  }, [transactions.data, page])

  // Stop polling as soon as a successful deposit shows up that's newer than
  // when we arrived, or after a timeout — whichever comes first.
  React.useEffect(() => {
    if (!confirming) return

    const found = transactions.data?.transactions.find(
      (t) =>
        t.type === "deposit" &&
        t.status === "successful" &&
        new Date(t.createdAt).getTime() >= arrivedAtRef.current - 60_000
    )
    if (found) {
      setConfirming(false)
      setConfirmed(true)
      return
    }

    const timeout = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [confirming, transactions.data])

  const hasMore = transactions.data ? page < transactions.data.totalPages : false

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        {justFunded && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-secondary",
              confirmed && "border-status-paid-bg bg-status-paid-bg text-status-paid-text"
            )}
          >
            {confirmed ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : confirming ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <RefreshCw className="size-4 shrink-0" />
            )}
            <p>
              {confirmed
                ? "Payment received — your balance has been updated."
                : confirming
                ? "Confirming your payment. This usually takes a few seconds…"
                : "We couldn't confirm your payment yet. If your balance doesn't update in a minute, please contact support."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Wallet</h1>
            {wallet.data && (
              <p className="text-sm text-text-muted">
                Balance:{" "}
                <span className="font-medium text-foreground">
                  {formatNaira(wallet.data.balance)}
                </span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-initial">
              <Link href="/wallet/transfer">
                <ArrowLeftRight className="size-4" />
                Transfer
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-initial">
              <Link href="/wallet/withdraw">
                <ArrowUpRight className="size-4" />
                Withdraw
              </Link>
            </Button>
            <Button asChild size="sm" className="flex-1 sm:flex-initial">
              <Link href="/wallet/fund">
                <Plus className="size-4" />
                Fund
              </Link>
            </Button>
          </div>
        </div>

        <section>
          <h2 className="mb-1 text-base font-semibold text-foreground">
            Transaction history
          </h2>

          {transactions.isPending && page === 1 ? (
            <TransactionListSkeleton />
          ) : transactions.isError && items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-10 text-center">
              <RefreshCw className="size-5 text-text-muted" />
              <p className="text-sm text-text-muted">Couldn&apos;t load transactions</p>
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
                {items.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-3 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={transactions.isFetching}
                  >
                    {transactions.isFetching ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-10 text-center">
              <RefreshCw className="size-5 text-text-muted" />
              <p className="text-sm text-text-muted">No transactions yet</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function TransactionListSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card px-4 divide-y divide-border">
      {[0, 1, 2, 3, 4, 5].map((i) => (
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
  )
}

// useSearchParams() requires a Suspense boundary in Next.js App Router.
export default function WalletPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-sm text-text-muted">Loading…</p>
        </div>
      }
    >
      <WalletPageInner />
    </React.Suspense>
  )
}