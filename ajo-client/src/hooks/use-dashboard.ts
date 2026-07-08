import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { MOCK_DASHBOARD } from "@/lib/mock-data"
import type { DashboardSummary } from "@/lib/types"

/**
 * Toggle this to switch between mock data and real API.
 * Set to false once the NestJS backend's /dashboard endpoint is ready.
 * (Groups/wallet/chat/friends/messages have all moved to real endpoints —
 * see use-groups.ts, use-wallet.ts, use-chat.ts, use-friends.ts, use-direct-messages.ts.)
 */
const USE_MOCK = true

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
    queryFn: () =>
      USE_MOCK
        ? Promise.resolve(MOCK_DASHBOARD)
        : apiClient.get<DashboardSummary>("/dashboard"),
  })
}