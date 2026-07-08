// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  fullName: string
  email: string
  phone: string
  avatarUrl?: string
  reputationScore: number
  createdAt: string
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

export interface Wallet {
  id: string
  accountNumber: string
  balance: number
  currency: "NGN"
  hasTransactionPin: boolean
}

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "contribution"
  | "payout"
  | "reversal"

export type TransactionStatus = "pending" | "successful" | "failed" | "reversed"

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  currency: "NGN"
  status: TransactionStatus
  description: string
  reference: string
  createdAt: string
  /** Set for transfer transactions */
  counterpartyName?: string
  /** Set for group-related transactions */
  groupId?: string
  groupName?: string
}

export interface Beneficiary {
  id: string
  name: string
  accountNumber: string
  bankName: string
  /** Set if this is an internal Ajo user */
  userId?: string
  avatarUrl?: string
}

// ─── Ajo Groups ───────────────────────────────────────────────────────────────

export type GroupFrequency = "daily" | "weekly" | "monthly" | "testing"
export type GroupVisibility = "public" | "private"
export type GroupStatus = "pending" | "active" | "completed" | "cancelled"
export type GroupActivationMode = "auto_start_when_full" | "manual_start_by_admin"
export type JoinRequestStatus = "pending" | "approved" | "rejected"

export type MemberStatus =
  | "active"
  | "late"
  | "defaulted"
  | "exited"
  | "inactive"

export type ContributionStatus = "paid" | "pending" | "late" | "defaulted"

export interface GroupMember {
  id: string
  userId: string
  fullName: string
  avatarUrl?: string
  role: "admin" | "member"
  status: MemberStatus
  payoutOrder: number
  /** Which round this member receives their payout */
  payoutRound: number
  hasReceivedPayout: boolean
  joinedAt: string
}

export interface GroupJoinRequest {
  id: string
  userId: string
  fullName: string
  avatarUrl?: string
  reputationScore: number
  message?: string
  status: JoinRequestStatus
  createdAt: string
}

export interface RoundContribution {
  id: string
  memberId: string
  userId: string
  fullName: string
  avatarUrl?: string
  status: ContributionStatus
  amount: number
  dueDate: string
  paidAt?: string
}

export interface Round {
  id: string
  number: number
  payoutMemberId: string
  payoutMemberName: string
  payoutMemberAvatarUrl?: string
  status: "upcoming" | "active" | "completed"
  contributions: RoundContribution[]
  payoutReleasedAt?: string
  startDate: string
  endDate: string
}

export interface AjoGroup {
  id: string
  name: string
  description?: string
  contributionAmount: number     // Total pot per round (e.g. ₦30,000)
  memberShare: number            // Each member's contribution (contributionAmount / cycleLength)
  cycleLength: number            // Number of rounds = number of members
  frequency: GroupFrequency
  visibility: GroupVisibility
  status: GroupStatus
  activationMode: GroupActivationMode
  gracePeriodHours?: number
  currentRound: number
  totalRounds: number
  memberCount: number
  slotsRemaining: number
  members: GroupMember[]
  rounds: Round[]
  creatorId: string
  /** Only present when the current user is the group admin */
  inviteCode?: string
  createdAt: string
  nextContributionDate?: string
  /** Current user's role in this group ("admin" | "member"), null if not a member */
  myRole: "admin" | "member" | null
  /** Current user's status in this group */
  myStatus: MemberStatus | null
  /** Current user's contribution status this round */
  myContributionStatus: ContributionStatus
  /** Which round the current user receives their payout */
  myPayoutRound: number | null
  /** Has the current user received their payout */
  myPayoutReceived: boolean
  /** If the user isn't a member, their pending/approved/rejected join request status */
  myJoinRequestStatus?: JoinRequestStatus | null
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | "contribution_due"
  | "contribution_late"
  | "contribution_received"
  | "contribution_defaulted"
  | "payout_released"
  | "payout_received"
  | "member_joined"
  | "member_left"
  | "member_removed"
  | "invite_received"
  | "wallet_funded"
  | "wallet_transfer"
  | "group_started"
  | "group_completed"
  | "round_started"
  | "join_request_received"
  | "join_request_approved"
  | "join_request_rejected"
  | "direct_message_received"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  groupId?: string
  createdAt: string
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export interface Friend {
  friendshipId: string
  userId: string
  fullName: string
  avatarUrl?: string
  reputationScore: number
  friendsSince: string
}

// ─── Direct Messages ────────────────────────────────────────────────────────

export interface DirectMessage {
  id: string
  conversationId: string
  senderId: string
  senderName?: string
  senderAvatarUrl?: string
  content: string
  createdAt: string
}

export interface Conversation {
  conversationId: string
  otherUser: { id: string; fullName: string; avatarUrl?: string }
  lastMessage: string | null
  lastMessageAt: string | null
  unreadCount: number
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatMessageType = "user" | "system"

export interface ChatMessage {
  id: string
  groupId: string
  senderId?: string
  senderName?: string
  senderAvatarUrl?: string
  type: ChatMessageType
  systemEventType?: string
  content: string
  createdAt: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSummary {
  wallet: Wallet
  activeGroupsCount: number
  completedGroupsCount: number
  exitedGroupsCount: number
  nextContribution: {
    groupId: string
    groupName: string
    amount: number
    dueDate: string
    daysUntilDue: number
  } | null
  nextPayout: {
    groupId: string
    groupName: string
    amount: number
    round: number
  } | null
  recentTransactions: Transaction[]
}