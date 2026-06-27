"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/components/dashboard/nav-items"

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-bg-card lg:flex">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href="/dashboard" className="text-lg font-semibold text-primary">
          Ajo
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-text-secondary hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom user hint */}
      <div className="border-t border-border p-3">
        <p className="px-3 text-xs text-text-muted">Ajo &copy; {new Date().getFullYear()}</p>
      </div>
    </aside>
  )
}