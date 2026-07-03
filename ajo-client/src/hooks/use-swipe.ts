"use client"

import { useEffect, useRef } from "react"

interface SwipeHandlers {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Minimum horizontal distance in px to trigger a swipe (default: 50) */
  threshold?: number
  /** Max vertical drift in px before gesture is ignored (default: 80) */
  maxVerticalDrift?: number
}

/**
 * Attaches touch event listeners to a target element and fires
 * onSwipeLeft / onSwipeRight when the user swipes horizontally.
 *
 * Returns a ref to attach to the element you want to detect swipes on.
 */
export function useSwipe<T extends HTMLElement>({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxVerticalDrift = 80,
}: SwipeHandlers) {
  const ref = useRef<T>(null)
  const startX = useRef<number>(0)
  const startY = useRef<number>(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function handleTouchStart(e: TouchEvent) {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    }

    function handleTouchEnd(e: TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = Math.abs(e.changedTouches[0].clientY - startY.current)

      // Ignore if vertical drift is too large — user is scrolling, not swiping
      if (dy > maxVerticalDrift) return

      if (dx > threshold) {
        onSwipeRight?.()
      } else if (dx < -threshold) {
        onSwipeLeft?.()
      }
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [onSwipeLeft, onSwipeRight, threshold, maxVerticalDrift])

  return ref
}