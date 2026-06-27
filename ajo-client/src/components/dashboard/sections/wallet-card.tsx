"use client"

import { Eye, EyeOff, Plus, ArrowUpRight, ArrowLeftRight, Copy } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboard } from "@/hooks/use-dashboard"
import { cn } from "@/lib/utils"

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function WalletCard() {
  const { data, isPending, isError } = useDashboard()
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [copied, setCopied] = useState(false)

  if (isPending) return <WalletCardSkeleton />
  if (isError || !data) return null

  const { wallet } = data

  function copyAccountNumber() {
    navigator.clipboard.writeText(wallet.accountNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--primary-dark)_0%,var(--primary)_60%,var(--brand-accent)_140%)] p-5 text-primary-foreground shadow-md">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-10 -right-4 size-28 rounded-full bg-white/5" />

      {/* Top row — label + eye toggle */}
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-medium text-primary-foreground/70">
          Wallet Balance
        </p>
        <button
          onClick={() => setBalanceVisible((v) => !v)}
          aria-label={balanceVisible ? "Hide balance" : "Show balance"}
          className="rounded-full p-1 transition-colors hover:bg-white/10"
        >
          {balanceVisible
            ? <Eye className="size-4" />
            : <EyeOff className="size-4" />}
        </button>
      </div>

      {/* Balance */}
      <p className="relative mt-1 text-3xl font-semibold tracking-tight">
        {balanceVisible
          ? formatNaira(wallet.balance)
          : "₦ ••••••"}
      </p>

      {/* Account number */}
      <button
        onClick={copyAccountNumber}
        className="relative mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
      >
        <span>{wallet.accountNumber}</span>
        <Copy className="size-3" />
        {copied && (
          <span className="text-xs text-primary-foreground">Copied!</span>
        )}
      </button>

      {/* Quick actions */}
      <div className="relative mt-5 flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-white/15 text-primary-foreground hover:bg-white/25 border-0"
          asChild
        >
          <Link href="/wallet/fund">
            <Plus className="size-3.5" />
            Fund
          </Link>
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-white/15 text-primary-foreground hover:bg-white/25 border-0"
          asChild
        >
          <Link href="/wallet/withdraw">
            <ArrowUpRight className="size-3.5" />
            Withdraw
          </Link>
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-white/15 text-primary-foreground hover:bg-white/25 border-0"
          asChild
        >
          <Link href="/wallet/transfer">
            <ArrowLeftRight className="size-3.5" />
            Transfer
          </Link>
        </Button>
      </div>
    </div>
  )
}

export function WalletCardSkeleton() {
  return (
    <div className="rounded-2xl bg-muted p-5 shadow-md">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-8 w-48" />
      <Skeleton className="mt-1.5 h-4 w-32" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
    </div>
  )
}