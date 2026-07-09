import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/hooks/use-dashboard"
import type { Friend } from "@/lib/types"

export function useFriends() {
  return useQuery<Friend[]>({
    queryKey: queryKeys.friends(),
    queryFn: () => apiClient.get<Friend[]>("/friends"),
  })
}
