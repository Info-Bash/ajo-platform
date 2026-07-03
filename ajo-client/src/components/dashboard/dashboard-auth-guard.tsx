"use client"

import { useState, useCallback } from "react"
import { useAuth } from "@/providers/auth-provider"
import { useSwipe } from "@/hooks/use-swipe"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { BottomTabBar } from "@/components/dashboard/bottom-tab-bar"

export function DashboardAuthGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Stable callbacks — useCallback prevents useSwipe's effect from
  // tearing down and re-adding document listeners on every render
  const openMenu = useCallback(() => setMobileMenuOpen(true), [])
  const closeMenu = useCallback(() => setMobileMenuOpen(false), [])

  // Listen on document so swipe works even when Sheet overlay is active
  useSwipe({
    onSwipeRight: openMenu,
    onSwipeLeft: closeMenu,
    threshold: 50,
    maxVerticalDrift: 80,
    // Only enable on mobile — pointless overhead on desktop where
    // the sidebar is always visible. We can't use a media query here
    // (SSR), so we always enable and let the gesture be harmless on desktop.
    enabled: true,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const topbarUser = user
    ? {
        name: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl ?? undefined,
      }
    : undefined

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar — always visible lg+ */}
      <Sidebar onLogout={logout} />

      {/* Topbar with controlled mobile drawer + logout */}
      <Topbar
        user={topbarUser}
        notificationCount={0}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpen={openMenu}
        onMobileMenuClose={closeMenu}
        onLogout={logout}
      />

      <main className="pt-14 lg:pl-56">
        <div className="min-h-[calc(100vh-3.5rem)] pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      <BottomTabBar />
    </div>
  )
}