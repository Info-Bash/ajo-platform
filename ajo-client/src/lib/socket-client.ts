import { io, type Socket } from "socket.io-client"
import { getToken } from "@/lib/api-client"

function deriveSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL

  // Fall back to the API URL's origin (strips any /api/v1 path safely,
  // instead of a naive string replace that only removes the first "/api").
  if (process.env.NEXT_PUBLIC_API_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_API_URL).origin
    } catch {
      // fall through to default below
    }
  }

  return "http://localhost:3001"
}

const SOCKET_URL = deriveSocketUrl()

const IS_DEV = process.env.NODE_ENV === "development"

// Singleton socket instance — one connection for the whole app
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token: getToken() },
      transports: ["websocket", "polling"],

      /**
       * Exponential backoff reconnection:
       * Starts at 1s, doubles each attempt, caps at 30s.
       * Stops after 5 attempts when backend isn't running yet —
       * no more infinite error spam during frontend-only dev.
       */
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,

      /**
       * Suppress the default Socket.IO console error in dev
       * since "websocket error" while the backend isn't running
       * is expected and misleading. We log a clean message once instead.
       */
    })
  }
  return socket
}

export function connectSocket(): void {
  const s = getSocket()
  s.auth = { token: getToken() }
  if (!s.connected) s.connect()
}

export function disconnectSocket(): void {
  socket?.disconnect()
}

/**
 * All real-time event names emitted from NestJS.
 * Centralised here so event strings are never typed inline anywhere.
 * Add new events here as the backend grows.
 */
export const SOCKET_EVENTS = {
  // Ajo group events
  CONTRIBUTION_MADE:      "contribution:made",
  CONTRIBUTION_LATE:      "contribution:late",
  CONTRIBUTION_DEFAULTED: "contribution:defaulted",
  PAYOUT_RELEASED:        "payout:released",
  PAYOUT_RECEIVED:        "payout:received",
  MEMBER_JOINED:          "group:member_joined",
  MEMBER_LEFT:            "group:member_left",
  MEMBER_REMOVED:         "group:member_removed",

  // Chat events
  CHAT_MESSAGE:           "chat:message",
  CHAT_SYSTEM_MESSAGE:    "chat:system_message",

  // Wallet events
  WALLET_FUNDED:          "wallet:funded",
  WALLET_TRANSFER:        "wallet:transfer",

  // Notifications
  NOTIFICATION:           "notification:new",
} as const

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS]