// Canonical real-time event names emitted over the socket.
// Mirrors client/src/lib/socket-client.ts SOCKET_EVENTS — keep both in sync
// whenever an event is added here.
export const REALTIME_EVENTS = {
  // Wallet events
  WALLET_FUNDED: 'wallet:funded',
  WALLET_TRANSFER: 'wallet:transfer',

  // Ajo group events (emitted once GroupsModule/ContributionsModule/
  // PayoutsModule land — kept here so the contract is defined up front)
  CONTRIBUTION_MADE: 'contribution:made',
  CONTRIBUTION_LATE: 'contribution:late',
  CONTRIBUTION_DEFAULTED: 'contribution:defaulted',
  PAYOUT_RELEASED: 'payout:released',
  PAYOUT_RECEIVED: 'payout:received',
  MEMBER_JOINED: 'group:member_joined',
  MEMBER_LEFT: 'group:member_left',
  MEMBER_REMOVED: 'group:member_removed',

  // Chat events
  CHAT_MESSAGE: 'chat:message',
  CHAT_SYSTEM_MESSAGE: 'chat:system_message',

  // Direct message events
  DIRECT_MESSAGE: 'dm:message',

  // Notifications — generic envelope, fired alongside the specific event
  // above so the client can maintain a single notification feed.
  NOTIFICATION: 'notification:new',
} as const;

export type RealtimeEvent =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
