import { useQuery, useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/hooks/use-dashboard"
import type { Wallet, Transaction, TransactionType, TransactionStatus } from "@/lib/types"

/**
 * Real wallet endpoints, wired to the NestJS backend's WalletController
 * (GET /wallet, GET /wallet/transactions, POST /wallet/fund).
 *
 * The backend and frontend model money/enums slightly differently:
 * - backend amounts are kobo + a derived Naira field; frontend just wants Naira
 * - backend uses SCREAMING_CASE enums; frontend uses lowercase
 * - backend represents transfers as one TRANSFER type + a CREDIT/DEBIT
 *   direction; frontend splits that into transfer_in / transfer_out
 * All of that translation is kept in the mappers below so the rest of the
 * app can keep working against the existing `Transaction` / `Wallet` shapes.
 */

// ─── Raw backend shapes (mirrors wallet.controller.ts Swagger classes) ───────

interface BackendWallet {
  id: string
  accountNumber: string
  balanceKobo: number
  balanceNaira: number
  createdAt: string
}

type BackendTransactionType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER"
  | "CONTRIBUTION"
  | "PAYOUT"
  | "REVERSAL"

interface BackendTransaction {
  id: string
  direction: "CREDIT" | "DEBIT"
  type: BackendTransactionType
  status: "PENDING" | "SUCCESSFUL" | "FAILED" | "REVERSED"
  amountKobo: number
  amountNaira: number
  reference?: string
  description?: string
  counterpartyName?: string
  createdAt: string
}

interface BackendTransactionList {
  data: BackendTransaction[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
  }
}

interface FundWalletResponse {
  checkoutLink: string
  orderReference: string
  amount: number
  amountKobo: number
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapWallet(raw: BackendWallet): Wallet {
  return {
    id: raw.id,
    accountNumber: raw.accountNumber,
    balance: raw.balanceNaira,
    currency: "NGN",
  }
}

function mapTransactionType(raw: BackendTransaction): TransactionType {
  if (raw.type === "TRANSFER") {
    return raw.direction === "CREDIT" ? "transfer_in" : "transfer_out"
  }
  const map: Record<Exclude<BackendTransactionType, "TRANSFER">, TransactionType> = {
    DEPOSIT: "deposit",
    WITHDRAWAL: "withdrawal",
    CONTRIBUTION: "contribution",
    PAYOUT: "payout",
    REVERSAL: "reversal",
  }
  return map[raw.type as Exclude<BackendTransactionType, "TRANSFER">]
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

// ─── Wallet balance ─────────────────────────────────────────────────────────

export function useWallet() {
  return useQuery<Wallet>({
    queryKey: queryKeys.wallet(),
    queryFn: () => apiClient.get<BackendWallet>("/wallet").then(mapWallet),
  })
}

// ─── Transactions ─────────────────────────────────────────────────────────────

interface UseTransactionsOptions {
  limit?: number
  page?: number
  /** Backend filter type, e.g. "DEPOSIT" — omit to return all types */
  type?: BackendTransactionType
}

interface TransactionsResult {
  transactions: Transaction[]
  total: number
  totalPages: number
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { limit = 20, page = 1, type } = options

  return useQuery<TransactionsResult>({
    queryKey: [...queryKeys.transactions(), { limit, page, type }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
      })
      if (type) params.set("type", type)

      const res = await apiClient.get<BackendTransactionList>(
        `/wallet/transactions?${params.toString()}`
      )

      return {
        transactions: res.data.map(mapTransaction),
        total: res.meta.total,
        totalPages: res.meta.totalPages,
      }
    },
  })
}

// ─── Fund wallet ────────────────────────────────────────────────────────────
// Creates a Nomba checkout order. The caller is responsible for redirecting
// (window.location.href) to the returned checkoutLink — it's an external
// hosted payment page, not an in-app route.

export function useFundWallet() {
  return useMutation<FundWalletResponse, Error, { amount: number }>({
    mutationFn: (data) => apiClient.post<FundWalletResponse>("/wallet/fund", data),
  })
}