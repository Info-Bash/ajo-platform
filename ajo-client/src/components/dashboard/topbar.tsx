"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, MessageCircle, LayoutGrid } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { NAV_ITEMS } from "@/components/dashboard/nav-items"

interface TopbarProps {
  user?: {
    name: string
    email: string
    avatarUrl?: string
  }
  notificationCount?: number
  /** Controlled open state for the mobile drawer — managed by parent */
  mobileMenuOpen: boolean
  onMobileMenuOpen: () => void
  onMobileMenuClose: () => void
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function Topbar({
  user,
  notificationCount = 0,
  mobileMenuOpen,
  onMobileMenuOpen,
  onMobileMenuClose,
}: TopbarProps) {
  const pathname = usePathname()

  const currentNav = NAV_ITEMS.find(
    ({ href }) => pathname === href || pathname.startsWith(href + "/")
  )
  const pageTitle = currentNav?.label ?? "Dashboard"

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b border-border bg-bg-card px-4 lg:left-56 lg:px-6">

      {/* Mobile: drawer trigger + logo */}
      <div className="flex items-center gap-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={onMobileMenuOpen}
        >
          <LayoutGrid className="size-5" />
        </Button>

        {/* Mobile Sheet — controlled open state */}
        <Sheet open={mobileMenuOpen} onOpenChange={(open) => !open && onMobileMenuClose()}>
          <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
            <SheetHeader className="border-b border-border px-5 py-3.5">
              <SheetTitle className="text-primary">Ajo</SheetTitle>
            </SheetHeader>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/")
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onMobileMenuClose}  // close on nav item click
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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

            <div className="border-t border-border p-4">
              {user && (
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    {user.avatarUrl && (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    )}
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <span className="text-base font-semibold text-primary">Ajo</span>
      </div>

      {/* Desktop: current page title */}
      <h1 className="hidden text-base font-semibold text-foreground lg:block">
        {pageTitle}
      </h1>

      {/* Right side: notifications, messages, avatar — logout removed */}
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Messages" asChild>
          <Link href="/messages">
            <MessageCircle className="size-5 text-text-secondary" />
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
          className="relative"
          asChild
        >
          <Link href="/notifications">
            <Bell className="size-5 text-text-secondary" />
            {notificationCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-brand-accent" />
            )}
          </Link>
        </Button>

        <Link href="/settings/profile" aria-label="Profile settings">
          <Avatar
            size="sm"
            className="ml-1 cursor-pointer ring-2 ring-transparent transition-all hover:ring-primary/30"
          >
            {user?.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={user?.name ?? "User"} />
            )}
            <AvatarFallback>{user ? initials(user.name) : "?"}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}