import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  TrendingUp,
  RefreshCw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { Transaction, TransactionType } from "@/lib/types"

export const TYPE_CONFIG: Record<
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

export function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function TransactionRow({ tx }: { tx: Transaction }) {
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