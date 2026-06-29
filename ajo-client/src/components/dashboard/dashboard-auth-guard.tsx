"use client"

import { useAuth } from "@/providers/auth-provider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { BottomTabBar } from "@/components/dashboard/bottom-tab-bar"

export function DashboardAuthGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, logout } = useAuth()

  // While checking token / fetching user, show minimal shell
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

  // User is authenticated — render the full shell
  const topbarUser = user
    ? {
        name: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl ?? undefined,
      }
    : undefined

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Topbar
        user={topbarUser}
        notificationCount={0}
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