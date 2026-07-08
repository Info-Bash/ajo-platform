// Canonical values for ChatMessage.systemEventType. Keep in sync with the
// client's chat message renderer (picks an icon per event type).
export const SYSTEM_EVENTS = {
  GROUP_CREATED: 'GROUP_CREATED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  MEMBER_LEFT: 'MEMBER_LEFT',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  GROUP_ACTIVATED: 'GROUP_ACTIVATED',
  CONTRIBUTION_REMINDER: 'CONTRIBUTION_REMINDER',
  CONTRIBUTION_COMPLETED: 'CONTRIBUTION_COMPLETED',
  PAYOUT_RELEASED: 'PAYOUT_RELEASED',
  GROUP_COMPLETED: 'GROUP_COMPLETED',
} as const;

export type SystemEventType = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS];
