"use client"

import { useState } from "react"
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

  // Swipe gestures — attach to the main content area
  // Swipe right → open drawer, swipe left → close drawer
  // Only meaningful on mobile (lg: sidebar is always visible)
  const swipeRef = useSwipe<HTMLDivElement>({
    onSwipeRight: () => setMobileMenuOpen(true),
    onSwipeLeft: () => setMobileMenuOpen(false),
    threshold: 60,          // require intentional 60px horizontal swipe
    maxVerticalDrift: 80,   // ignore if user is mostly scrolling vertically
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
      {/* Desktop sidebar — always visible on lg+ */}
      <Sidebar onLogout={logout} />

      {/* Topbar — owns the mobile Sheet, receives controlled open state */}
      <Topbar
        user={topbarUser}
        notificationCount={0}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpen={() => setMobileMenuOpen(true)}
        onMobileMenuClose={() => setMobileMenuOpen(false)}
      />

      {/*
        Main content area — swipe ref lives here so the full page
        area is the swipe target, not just a small strip.
        On desktop (lg:) swipe is irrelevant since sidebar is fixed.
      */}
      <main ref={swipeRef} className="pt-14 lg:pl-56">
        <div className="min-h-[calc(100vh-3.5rem)] pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      <BottomTabBar />
    </div>
  )
}