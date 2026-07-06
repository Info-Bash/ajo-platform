"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useSocket, SOCKET_EVENTS } from "@/providers/socket-provider"
import { queryKeys } from "@/hooks/use-dashboard"

interface WalletFundedPayload {
  amountKobo: number
  reference: string
}

interface WalletTransferPayload {
  direction: "CREDIT" | "DEBIT"
  amount: number
  reference: string
  counterpartyName: string
}

function isWalletFundedPayload(data: unknown): data is WalletFundedPayload {
  return typeof data === "object" && data !== null && "amountKobo" in data
}

function isWalletTransferPayload(data: unknown): data is WalletTransferPayload {
  return typeof data === "object" && data !== null && "direction" in data
}

/**
 * Subscribes to server-pushed wallet events (funding, transfers) for the
 * lifetime of the mounting component and keeps the wallet/transactions
 * query cache in sync in real time — no polling needed.
 *
 * Mount this once near the top of the authenticated app (e.g. inside
 * DashboardAuthGuard) rather than in every component that reads wallet data;
 * useWallet()/useTransactions() elsewhere just read the cache this keeps fresh.
 */
export function useRealtimeWallet() {
  const { on } = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    const offFunded = on(SOCKET_EVENTS.WALLET_FUNDED, (data) => {
      if (!isWalletFundedPayload(data)) return

      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })

      const naira = (data.amountKobo / 100).toLocaleString("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
      })
      toast.success("Wallet funded", { description: `${naira} credited to your wallet` })
    })

    const offTransfer = on(SOCKET_EVENTS.WALLET_TRANSFER, (data) => {
      if (!isWalletTransferPayload(data)) return

      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })

      const naira = data.amount.toLocaleString("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
      })

      if (data.direction === "CREDIT") {
        toast.success("Money received", {
          description: `${naira} from ${data.counterpartyName}`,
        })
      } else {
        toast("Transfer sent", {
          description: `${naira} to ${data.counterpartyName}`,
        })
      }
    })

    return () => {
      offFunded()
      offTransfer()
    }
  }, [on, queryClient])
}
