"use client"

import React, { createContext, useContext, useEffect, useRef } from "react"
import type { Socket } from "socket.io-client"
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  SOCKET_EVENTS,
  type SocketEvent,
} from "@/lib/socket-client"

interface SocketContextValue {
  socket: Socket
  /** Subscribe to a socket event, auto-cleaned up on unmount */
  on: (event: SocketEvent | string, handler: (...args: unknown[]) => void) => void
  /** Emit an event to the server */
  emit: (event: string, data?: unknown) => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket>(getSocket())

  useEffect(() => {
    connectSocket()

    const socket = socketRef.current

    socket.on("connect", () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] Connected:", socket.id)
      }
    })

    socket.on("disconnect", (reason) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Socket] Disconnected:", reason)
      }
    })

    // Only log once when all reconnection attempts are exhausted —
    // not on every failed attempt, which spams the console.
    socket.on("reconnect_failed", () => {
      if (process.env.NODE_ENV === "development") {
        console.info(
          "[Socket] Could not connect to backend — running in offline/mock mode. " +
          "Start the NestJS server to enable real-time features."
        )
      }
    })

    return () => {
      disconnectSocket()
    }
  }, [])

  function on(event: SocketEvent | string, handler: (...args: unknown[]) => void) {
    socketRef.current.on(event, handler)
  }

  function emit(event: string, data?: unknown) {
    socketRef.current.emit(event, data)
  }

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, on, emit }}>
      {children}
    </SocketContext.Provider>
  )
}

/**
 * Access the socket connection from any client component.
 *
 * Usage:
 *   const { on, emit } = useSocket()
 *
 *   useEffect(() => {
 *     on(SOCKET_EVENTS.CONTRIBUTION_MADE, (data) => {
 *       queryClient.invalidateQueries({ queryKey: ["circle", data.groupId] })
 *     })
 *   }, [on])
 */
export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider")
  return ctx
}

export { SOCKET_EVENTS }