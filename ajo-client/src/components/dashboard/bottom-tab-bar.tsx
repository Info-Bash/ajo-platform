"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/components/dashboard/nav-items"

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center border-t border-border bg-bg-card lg:hidden">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Icon
              className={cn(
                "size-5 transition-transform",
                active && "scale-110"
              )}
              strokeWidth={active ? 2.5 : 1.75}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}