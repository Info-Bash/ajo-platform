import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, ApiError } from "@/lib/api-client"
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

export function useWallet(options: { refetchInterval?: number | false } = {}) {
  return useQuery<Wallet>({
    queryKey: queryKeys.wallet(),
    queryFn: () => apiClient.get<BackendWallet>("/wallet").then(mapWallet),
    refetchInterval: options.refetchInterval,
  })
}

// ─── Transactions ─────────────────────────────────────────────────────────────

interface UseTransactionsOptions {
  limit?: number
  page?: number
  /** Backend filter type, e.g. "DEPOSIT" — omit to return all types */
  type?: BackendTransactionType
  refetchInterval?: number | false
}

interface TransactionsResult {
  transactions: Transaction[]
  total: number
  totalPages: number
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { limit = 20, page = 1, type, refetchInterval } = options

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
    refetchInterval,
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

// ─── Lookup account (recipient preview before transfer) ────────────────────

interface LookupAccountResponse {
  accountNumber: string
  name: string
  avatarUrl: string | null
}

/**
 * Looks up an Ajo account by its 10-digit account number so the transfer
 * flow can show a "confirm recipient" step before money moves.
 * Only enabled once the account number is a full 10 digits.
 */
export function useLookupAccount(accountNumber: string) {
  const enabled = /^\d{10}$/.test(accountNumber)

  return useQuery<LookupAccountResponse>({
    queryKey: ["wallet-lookup", accountNumber],
    queryFn: () =>
      apiClient.get<LookupAccountResponse>(`/wallet/lookup/${accountNumber}`),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
}

// ─── Transfer to another Ajo user ───────────────────────────────────────────

interface TransferResponse {
  message: string
  reference: string
  amount: number
  recipient: { name: string; accountNumber: string }
}

interface TransferPayload {
  accountNumber: string
  amount: number
  description?: string
}

export function useTransfer() {
  const queryClient = useQueryClient()

  return useMutation<TransferResponse, ApiError, TransferPayload>({
    mutationFn: (data) => apiClient.post<TransferResponse>("/wallet/transfer", data),
    onSuccess: () => {
      // Balance and history both changed — refetch rather than hand-patch
      // the cache, since the backend is the source of truth for the ledger.
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })
    },
  })
}