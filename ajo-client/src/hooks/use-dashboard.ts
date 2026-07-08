import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { DashboardSummary, Wallet, Transaction, TransactionType, TransactionStatus } from "@/lib/types"

// ─── Raw backend shape (mirrors dashboard.controller.ts) ───────────────────
// Reuses the exact same wallet/transaction shapes as use-wallet.ts, since
// DashboardService just delegates to WalletService for those parts.

interface BackendWallet {
  id: string
  accountNumber: string
  balanceKobo: number
  balanceNaira: number
  createdAt: string
  hasTransactionPin: boolean
}

interface BackendTransaction {
  id: string
  direction: "CREDIT" | "DEBIT"
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "CONTRIBUTION" | "PAYOUT" | "REVERSAL"
  status: "PENDING" | "SUCCESSFUL" | "FAILED" | "REVERSED"
  amountKobo: number
  amountNaira: number
  reference?: string
  description?: string
  counterpartyName?: string
  createdAt: string
}

interface BackendDashboardSummary {
  wallet: BackendWallet
  activeGroupsCount: number
  completedGroupsCount: number
  exitedGroupsCount: number
  nextContribution: {
    groupId: string
    groupName: string
    amountKobo: number
    amountNaira: number
    dueDate: string
    daysUntilDue: number
  } | null
  nextPayout: {
    groupId: string
    groupName: string
    amountKobo: number
    amountNaira: number
    round: number
  } | null
  recentTransactions: BackendTransaction[]
}

function mapWallet(raw: BackendWallet): Wallet {
  return {
    id: raw.id,
    accountNumber: raw.accountNumber,
    balance: raw.balanceNaira,
    currency: "NGN",
    hasTransactionPin: raw.hasTransactionPin,
  }
}

function mapTransactionType(raw: BackendTransaction): TransactionType {
  if (raw.type === "TRANSFER") return raw.direction === "CREDIT" ? "transfer_in" : "transfer_out"
  const map: Record<Exclude<BackendTransaction["type"], "TRANSFER">, TransactionType> = {
    DEPOSIT: "deposit",
    WITHDRAWAL: "withdrawal",
    CONTRIBUTION: "contribution",
    PAYOUT: "payout",
    REVERSAL: "reversal",
  }
  return map[raw.type as Exclude<BackendTransaction["type"], "TRANSFER">]
}

function mapTransaction(raw: BackendTransaction): Transaction {
  return {
    id: raw.id,
    type: mapTransactionType(raw),
    amount: raw.amountNaira,
    currency: "NGN",
    status: raw.status.toLowerCase() as TransactionStatus,
    description: raw.description ?? "",
    reference: raw.reference ?? "",
    createdAt: raw.createdAt,
    counterpartyName: raw.counterpartyName,
  }
}

function mapDashboard(raw: BackendDashboardSummary): DashboardSummary {
  return {
    wallet: mapWallet(raw.wallet),
    activeGroupsCount: raw.activeGroupsCount,
    completedGroupsCount: raw.completedGroupsCount,
    exitedGroupsCount: raw.exitedGroupsCount,
    nextContribution: raw.nextContribution
      ? {
          groupId: raw.nextContribution.groupId,
          groupName: raw.nextContribution.groupName,
          amount: raw.nextContribution.amountNaira,
          dueDate: raw.nextContribution.dueDate,
          daysUntilDue: raw.nextContribution.daysUntilDue,
        }
      : null,
    nextPayout: raw.nextPayout
      ? {
          groupId: raw.nextPayout.groupId,
          groupName: raw.nextPayout.groupName,
          amount: raw.nextPayout.amountNaira,
          round: raw.nextPayout.round,
        }
      : null,
    recentTransactions: raw.recentTransactions.map(mapTransaction),
  }
}

// ─── Query keys ──────────────────────────────────────────────────────────────
// Centralised here so invalidation calls across the app stay consistent.

export const queryKeys = {
  dashboard:    ()         => ["dashboard"]               as const,
  wallet:       ()         => ["wallet"]                  as const,
  groups:       ()         => ["groups"]                  as const,
  group:        (id: string) => ["groups", id]            as const,
  contributions:(groupId: string) => ["contributions", groupId] as const,
  schedule:     (groupId: string) => ["schedule", groupId] as const,
  payouts:      ()         => ["payouts"]                 as const,
  transactions: ()         => ["transactions"]            as const,
  notifications:()         => ["notifications"]           as const,
  friends:      ()         => ["friends"]                 as const,
  conversations:()         => ["conversations"]            as const,
  messages:     (otherUserId: string) => ["messages", otherUserId] as const,
  chat:         (groupId: string) => ["chat", groupId]    as const,
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery<DashboardSummary>({
    queryKey: queryKeys.dashboard(),
    queryFn: () => apiClient.get<BackendDashboardSummary>("/dashboard").then(mapDashboard),
  })
}