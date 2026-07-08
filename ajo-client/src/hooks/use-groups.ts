import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, ApiError } from "@/lib/api-client"
import { queryKeys } from "@/hooks/use-dashboard"
import type {
  AjoGroup,
  GroupMember,
  GroupJoinRequest,
  GroupFrequency,
  GroupVisibility,
  GroupStatus,
  GroupActivationMode,
  MemberStatus,
  JoinRequestStatus,
} from "@/lib/types"

const toNaira = (kobo: number) => kobo / 100

// ─── Raw backend shapes ─────────────────────────────────────────────────────

interface BackendGroupSummary {
  id: string
  name: string
  contributionAmountKobo: number
  memberShareKobo: number
  cycleLength: number
  frequency: string
  visibility: string
  status: string
  currentRound: number
  creatorId: string
  createdAt: string
  memberCount: number
  slotsRemaining: number
  myRole: "ADMIN" | "MEMBER" | null
  myStatus: string | null
  myPayoutRound: number | null
  myPayoutReceived: boolean
}

interface BackendGroupMember {
  id: string
  userId: string
  fullName: string
  avatarUrl?: string
  role: "ADMIN" | "MEMBER"
  status: string
  payoutOrder: number
  payoutRound: number
  hasReceivedPayout: boolean
  joinedAt: string
}

interface BackendGroupDetail extends BackendGroupSummary {
  description?: string
  gracePeriodHours: number
  activationMode: string
  inviteCode?: string
  myJoinRequestStatus: string | null
  members: BackendGroupMember[]
}

interface BackendJoinRequest {
  id: string
  userId: string
  message?: string
  status: string
  createdAt: string
  user: { id: string; fullName: string; avatarUrl?: string; reputationScore: number }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapFrequency(f: string): GroupFrequency {
  return f.toLowerCase() as GroupFrequency
}
function mapVisibility(v: string): GroupVisibility {
  return v.toLowerCase() as GroupVisibility
}
function mapStatus(s: string): GroupStatus {
  return s.toLowerCase() as GroupStatus
}
function mapActivationMode(m: string): GroupActivationMode {
  return m.toLowerCase() as GroupActivationMode
}
function mapMemberStatus(s: string | null): MemberStatus | null {
  return s ? (s.toLowerCase() as MemberStatus) : null
}
function mapJoinRequestStatus(s: string): JoinRequestStatus {
  return s.toLowerCase() as JoinRequestStatus
}

function mapGroupSummary(raw: BackendGroupSummary): AjoGroup {
  return {
    id: raw.id,
    name: raw.name,
    contributionAmount: toNaira(raw.contributionAmountKobo),
    memberShare: toNaira(raw.memberShareKobo),
    cycleLength: raw.cycleLength,
    frequency: mapFrequency(raw.frequency),
    visibility: mapVisibility(raw.visibility),
    status: mapStatus(raw.status),
    activationMode: "auto_start_when_full", // overwritten by mapGroupDetail when available
    currentRound: raw.currentRound,
    totalRounds: raw.cycleLength,
    memberCount: raw.memberCount,
    slotsRemaining: raw.slotsRemaining,
    members: [],
    rounds: [],
    creatorId: raw.creatorId,
    createdAt: raw.createdAt,
    myRole: raw.myRole ? (raw.myRole.toLowerCase() as "admin" | "member") : null,
    myStatus: mapMemberStatus(raw.myStatus),
    myContributionStatus: "pending",
    myPayoutRound: raw.myPayoutRound,
    myPayoutReceived: raw.myPayoutReceived,
  }
}

function mapMember(raw: BackendGroupMember): GroupMember {
  return {
    id: raw.id,
    userId: raw.userId,
    fullName: raw.fullName,
    avatarUrl: raw.avatarUrl,
    role: raw.role.toLowerCase() as "admin" | "member",
    status: raw.status.toLowerCase() as MemberStatus,
    payoutOrder: raw.payoutOrder,
    payoutRound: raw.payoutRound,
    hasReceivedPayout: raw.hasReceivedPayout,
    joinedAt: raw.joinedAt,
  }
}

function mapGroupDetail(raw: BackendGroupDetail): AjoGroup {
  return {
    ...mapGroupSummary(raw),
    description: raw.description,
    gracePeriodHours: raw.gracePeriodHours,
    activationMode: mapActivationMode(raw.activationMode),
    inviteCode: raw.inviteCode,
    myJoinRequestStatus: raw.myJoinRequestStatus ? mapJoinRequestStatus(raw.myJoinRequestStatus) : null,
    members: raw.members.map(mapMember),
  }
}

function mapJoinRequest(raw: BackendJoinRequest): GroupJoinRequest {
  return {
    id: raw.id,
    userId: raw.userId,
    fullName: raw.user.fullName,
    avatarUrl: raw.user.avatarUrl,
    reputationScore: raw.user.reputationScore,
    message: raw.message,
    status: mapJoinRequestStatus(raw.status),
    createdAt: raw.createdAt,
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function useMyGroups() {
  return useQuery<AjoGroup[]>({
    queryKey: queryKeys.groups(),
    queryFn: () => apiClient.get<BackendGroupSummary[]>("/groups/mine").then((rows) => rows.map(mapGroupSummary)),
  })
}

export function useGroupDetail(groupId: string) {
  return useQuery<AjoGroup>({
    queryKey: queryKeys.group(groupId),
    queryFn: () => apiClient.get<BackendGroupDetail>(`/groups/${groupId}`).then(mapGroupDetail),
    enabled: !!groupId,
  })
}

interface PublicGroupsResult {
  groups: AjoGroup[]
  total: number
  totalPages: number
}

export function usePublicGroups(page = 1, limit = 20) {
  return useQuery<PublicGroupsResult>({
    queryKey: ["groups", "public", page, limit],
    queryFn: async () => {
      const res = await apiClient.get<{ data: BackendGroupSummary[]; meta: { total: number; totalPages: number } }>(
        `/groups/public?page=${page}&limit=${limit}`,
      )
      return { groups: res.data.map(mapGroupSummary), total: res.meta.total, totalPages: res.meta.totalPages }
    },
  })
}

export function useJoinRequests(groupId: string) {
  return useQuery<GroupJoinRequest[]>({
    queryKey: ["groups", groupId, "join-requests"],
    queryFn: () =>
      apiClient.get<BackendJoinRequest[]>(`/groups/${groupId}/join-requests`).then((rows) => rows.map(mapJoinRequest)),
    enabled: !!groupId,
  })
}

// ─── Create ───────────────────────────────────────────────────────────────────

interface CreateGroupPayload {
  name: string
  description?: string
  memberShareAmount: number
  cycleLength: number
  frequency: string
  visibility: string
  activationMode: string
  gracePeriodHours?: number
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation<AjoGroup, ApiError, CreateGroupPayload>({
    mutationFn: (data) => apiClient.post<BackendGroupDetail>("/groups", data).then(mapGroupDetail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })
    },
  })
}

// ─── Join flows ─────────────────────────────────────────────────────────────

export function useJoinByInviteCode() {
  const queryClient = useQueryClient()
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (inviteCode) => apiClient.post<{ message: string }>(`/groups/join/${inviteCode}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups() })
      queryClient.invalidateQueries({ queryKey: queryKeys.friends() })
    },
  })
}

export function useRequestToJoin(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ message: string }, ApiError, { message?: string }>({
    mutationFn: (data) => apiClient.post<{ message: string }>(`/groups/${groupId}/join-requests`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
      queryClient.invalidateQueries({ queryKey: ["groups", "public"] })
    },
  })
}

export function useReviewJoinRequest(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, ApiError, { requestId: string; decision: "APPROVE" | "REJECT" }>({
    mutationFn: ({ requestId, decision }) =>
      apiClient.post<{ status: string }>(`/groups/${groupId}/join-requests/${requestId}/review`, { decision }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId, "join-requests"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.groups() })
    },
  })
}

export function useInviteUser(groupId: string) {
  return useMutation<{ message: string }, ApiError, { accountNumber: string }>({
    mutationFn: (data) => apiClient.post<{ message: string }>(`/groups/${groupId}/invite`, data),
  })
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

export function useActivateGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation<AjoGroup, ApiError, void>({
    mutationFn: () => apiClient.post<BackendGroupDetail>(`/groups/${groupId}/activate`).then(mapGroupDetail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.groups() })
    },
  })
}

export function useLeaveGroup() {
  const queryClient = useQueryClient()
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (groupId) => apiClient.delete<{ message: string }>(`/groups/${groupId}/membership`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups() })
    },
  })
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (userId) => apiClient.delete<{ message: string }>(`/groups/${groupId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
    },
  })
}

export function useTransferAdmin(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (userId) => apiClient.post<{ message: string }>(`/groups/${groupId}/transfer-admin/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) })
    },
  })
}
