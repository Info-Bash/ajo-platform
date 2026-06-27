import { Suspense } from "react"
import Link from "next/link"
import { Plus, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WalletCard, WalletCardSkeleton } from "@/components/dashboard/sections/wallet-card"
import { ContributionAlert } from "@/components/dashboard/sections/contribution-alert"
import { StatsRow, StatsRowSkeleton } from "@/components/dashboard/sections/stats-row"
import { GroupsGrid, GroupsGridSkeleton } from "@/components/dashboard/sections/groups-grid"
import { ActivityFeed, ActivityFeedSkeleton } from "@/components/dashboard/sections/activity-feed"

export default function DashboardPage() {
  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-5">

        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Good day 👋</h1>
          <p className="text-sm text-text-muted">Here&apos;s your savings overview</p>
        </div>

        {/* Wallet balance card */}
        <Suspense fallback={<WalletCardSkeleton />}>
          <WalletCard />
        </Suspense>

        {/* Contribution alert — only renders if something is due soon/overdue */}
        <Suspense fallback={null}>
          <ContributionAlert />
        </Suspense>

        {/* Stats row */}
        <Suspense fallback={<StatsRowSkeleton />}>
          <StatsRow />
        </Suspense>

        {/* Create / Join group CTAs */}
        <div className="flex gap-2">
          <Button className="flex-1" asChild>
            <Link href="/groups/new">
              <Plus className="size-4" />
              Create new Ajo Group
            </Link>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/groups/join">
              <UserPlus className="size-4" />
              Join a group
            </Link>
          </Button>
        </div>

        {/* Ajo groups grid */}
        <Suspense fallback={<GroupsGridSkeleton />}>
          <GroupsGrid />
        </Suspense>

        {/* Recent activity feed */}
        <Suspense fallback={<ActivityFeedSkeleton />}>
          <ActivityFeed />
        </Suspense>

      </div>
    </div>
  )
}