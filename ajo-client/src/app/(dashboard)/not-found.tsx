import Link from "next/link"
import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Catches unknown routes under the (dashboard) route group, e.g.
 * /wallet/withdraw before that page exists, or a stale/typo'd link.
 * Nests inside app/(dashboard)/layout.tsx, so it renders with the sidebar,
 * topbar, and bottom tab bar still in place — the user never loses the
 * app shell, they just see an empty result where the page would be.
 */
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-6 text-text-muted" />
      </div>

      <h1 className="mt-5 text-lg font-semibold text-foreground">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        It may have been moved, or this feature isn&apos;t live yet. Head
        back to your dashboard and try again.
      </p>

      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}