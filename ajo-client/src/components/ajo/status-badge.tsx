import * as React from "react"
import { Check, Clock, Crown, AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"

export type AjoStatus = "paid" | "pending" | "turn" | "overdue"

const statusConfig: Record<
  AjoStatus,
  { label: string; icon: React.ElementType; bg: string; text: string }
> = {
  paid: {
    label: "Paid",
    icon: Check,
    bg: "bg-status-paid-bg",
    text: "text-status-paid-text",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    bg: "bg-status-pending-bg",
    text: "text-status-pending-text",
  },
  turn: {
    label: "Your turn",
    icon: Crown,
    bg: "bg-status-turn-bg",
    text: "text-status-turn-text",
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    bg: "bg-status-overdue-bg",
    text: "text-status-overdue-text",
  },
}

interface StatusBadgeProps extends React.ComponentProps<"span"> {
  status: AjoStatus
  /** Override the default label (e.g. show a date instead of "Pending") */
  label?: string
  /** Hide the icon, text-only badge */
  hideIcon?: boolean
}

function StatusBadge({
  status,
  label,
  hideIcon = false,
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
      {...props}
    >
      {!hideIcon && <Icon className="size-3" strokeWidth={2.5} />}
      {label ?? config.label}
    </span>
  )
}

export { StatusBadge }