import { QueryProvider } from "@/providers/query-provider"
import { SocketProvider } from "@/providers/socket-provider"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { BottomTabBar } from "@/components/dashboard/bottom-tab-bar"

// TODO: replace with real session user from NestJS JWT
const MOCK_USER = {
  name: "Bashir Adamu",
  email: "bashir@example.com",
  avatarUrl: undefined,
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <SocketProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <Topbar user={MOCK_USER} notificationCount={3} />

          <main className="pt-14 lg:pl-56">
            <div className="min-h-[calc(100vh-3.5rem)] pb-20 lg:pb-0">
              {children}
            </div>
          </main>

          <BottomTabBar />
        </div>
      </SocketProvider>
    </QueryProvider>
  )
}