"use client"

import { useEffect, useCallback, useRef } from "react"

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
  maxVerticalDrift?: number
  enabled?: boolean
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxVerticalDrift = 80,
  enabled = true,
}: SwipeOptions) {
  // useRef is the correct way to hold mutable values across renders
  // without triggering re-renders and without violating React compiler rules
  const startX = useRef(0)
  const startY = useRef(0)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = Math.abs(e.changedTouches[0].clientY - startY.current)

      if (dy > maxVerticalDrift) return

      if (dx > threshold) {
        onSwipeRight?.()
      } else if (dx < -threshold) {
        onSwipeLeft?.()
      }
    },
    [onSwipeLeft, onSwipeRight, threshold, maxVerticalDrift]
  )

  useEffect(() => {
    if (!enabled) return

    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [enabled, handleTouchStart, handleTouchEnd])
}