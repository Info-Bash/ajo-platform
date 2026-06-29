import { QueryProvider } from "@/providers/query-provider"
import { SocketProvider } from "@/providers/socket-provider"
import { DashboardAuthGuard } from "@/components/dashboard/dashboard-auth-guard"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <SocketProvider>
        {/*
          DashboardAuthGuard reads from AuthContext (set in root layout).
          It renders the shell only when user is authenticated,
          otherwise shows a loading state while /auth/me resolves.
        */}
        <DashboardAuthGuard>
          {children}
        </DashboardAuthGuard>
      </SocketProvider>
    </QueryProvider>
  )
}