import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "@/lib/api-client"

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Data is considered fresh for 30 seconds.
         * After that, background refetch triggers on window focus.
         * For financial data we want reasonably fresh numbers
         * without hammering the API on every focus event.
         */
        staleTime: 1000 * 30,

        /**
         * Keep unused query data in cache for 5 minutes.
         * Navigating between dashboard sections won't re-fetch
         * if data is still within this window.
         */
        gcTime: 1000 * 60 * 5,

        /**
         * Retry once on failure, but never retry on 4xx errors
         * (bad request, not found, forbidden) since retrying
         * won't fix a client-side mistake or missing resource.
         */
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false
          return failureCount < 1
        },

        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        /**
         * Don't retry mutations — a failed contribution/transfer
         * should never silently retry; the user needs to confirm.
         */
        retry: false,
      },
    },
  })
}

// Browser singleton — reused across hot reloads in dev
let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new client (no shared state between requests)
    return makeQueryClient()
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}