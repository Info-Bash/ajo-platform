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
}

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "contribution"
  | "payout"

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

export type GroupFrequency = "daily" | "weekly" | "monthly"
export type GroupVisibility = "public" | "private"
export type GroupStatus = "pending" | "active" | "completed" | "cancelled"

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
  status: MemberStatus
  payoutOrder: number
  /** Which round this member receives their payout */
  payoutRound: number
  hasReceivedPayout: boolean
  contributionRate: number  // 0-100 percentage
}

export interface RoundContribution {
  memberId: string
  fullName: string
  avatarUrl?: string
  status: ContributionStatus
  paidAt?: string
}

export interface Round {
  number: number
  payoutMemberId: string
  payoutMemberName: string
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
  currentRound: number
  totalRounds: number
  members: GroupMember[]
  rounds: Round[]
  creatorId: string
  inviteCode?: string
  createdAt: string
  nextContributionDate?: string
  /** Current user's status in this group */
  myStatus: MemberStatus
  /** Current user's contribution status this round */
  myContributionStatus: ContributionStatus
  /** Which round the current user receives their payout */
  myPayoutRound: number
  /** Has the current user received their payout */
  myPayoutReceived: boolean
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | "contribution_due"
  | "contribution_late"
  | "contribution_received"
  | "payout_released"
  | "payout_received"
  | "member_joined"
  | "member_left"
  | "invite_received"
  | "wallet_funded"
  | "wallet_transfer"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  groupId?: string
  createdAt: string
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