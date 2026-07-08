import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, ApiError } from "@/lib/api-client"
import { queryKeys } from "@/hooks/use-dashboard"
import type { Round, RoundContribution, ContributionStatus } from "@/lib/types"

const toNaira = (kobo: number) => kobo / 100

interface BackendContribution {
  id: string
  status: string
  amountKobo: number
  dueDate: string
  paidAt?: string
  groupMemberId: string
  groupMember: { id: string; userId: string; user: { fullName: string; avatarUrl?: string } }
}

interface BackendRound {
  id: string
  roundNumber: number
  status: string
  startDate: string
  endDate: string
  payoutReleasedAt?: string
  payoutMemberId: string
  payoutMember: { id: string; user: { fullName: string; avatarUrl?: string } }
  contributions: BackendContribution[]
}

function mapRound(raw: BackendRound): Round {
  return {
    id: raw.id,
    number: raw.roundNumber,
    payoutMemberId: raw.payoutMemberId,
    payoutMemberName: raw.payoutMember.user.fullName,
    payoutMemberAvatarUrl: raw.payoutMember.user.avatarUrl,
    status: raw.status.toLowerCase() as Round["status"],
    startDate: raw.startDate,
    endDate: raw.endDate,
    payoutReleasedAt: raw.payoutReleasedAt,
    contributions: raw.contributions.map(
      (c): RoundContribution => ({
        id: c.id,
        memberId: c.groupMemberId,
        userId: c.groupMember.userId,
        fullName: c.groupMember.user.fullName,
        avatarUrl: c.groupMember.user.avatarUrl,
        status: c.status.toLowerCase() as ContributionStatus,
        amount: toNaira(c.amountKobo),
        dueDate: c.dueDate,
        paidAt: c.paidAt,
      }),
    ),
  }
}

export function useGroupSchedule(groupId: string) {
  return useQuery<Round[]>({
    queryKey: queryKeys.schedule(groupId),
    queryFn: () => apiClient.get<BackendRound[]>(`/groups/${groupId}/schedule`).then((rows) => rows.map(mapRound)),
    enabled: !!groupId,
  })
}

export function usePayContribution(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (contributionId) => apiClient.post<{ message: string }>(`/contributions/${contributionId}/pay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule(groupId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet() })
      queryClient.invalidateQueries({ queryKey: queryKeys.groups() })
    },
  })
}
