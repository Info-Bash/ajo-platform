import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { MOCK_DASHBOARD, MOCK_GROUPS } from "@/lib/mock-data"
import type { DashboardSummary, AjoGroup } from "@/lib/types"

/**
 * Toggle this to switch between mock data and real API.
 * Set to false once the NestJS backend is ready.
 */
const USE_MOCK = true

// ─── Query keys ──────────────────────────────────────────────────────────────
// Centralised here so invalidation calls across the app stay consistent.

export const queryKeys = {
  dashboard:    ()         => ["dashboard"]               as const,
  wallet:       ()         => ["wallet"]                  as const,
  groups:       ()         => ["groups"]                  as const,
  group:        (id: string) => ["groups", id]            as const,
  contributions:()         => ["contributions"]           as const,
  payouts:      ()         => ["payouts"]                 as const,
  transactions: ()         => ["transactions"]            as const,
  notifications:()         => ["notifications"]           as const,
  friends:      ()         => ["friends"]                 as const,
  messages:     ()         => ["messages"]                as const,
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

// ─── Groups ───────────────────────────────────────────────────────────────────

export function useGroups() {
  return useQuery<AjoGroup[]>({
    queryKey: queryKeys.groups(),
    queryFn: () =>
      USE_MOCK
        ? Promise.resolve(MOCK_GROUPS)
        : apiClient.get<AjoGroup[]>("/groups"),
  })
}

export function useGroup(id: string) {
  return useQuery<AjoGroup>({
    queryKey: queryKeys.group(id),
    queryFn: () =>
      USE_MOCK
        ? Promise.resolve(MOCK_GROUPS.find((g) => g.id === id)!)
        : apiClient.get<AjoGroup>(`/groups/${id}`),
    enabled: !!id,
  })
}