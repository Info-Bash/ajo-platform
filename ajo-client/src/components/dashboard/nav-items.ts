import type React from "react"
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowDownToLine,
  Settings,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",  icon: LayoutDashboard },
  { label: "Ajo Groups",  href: "/groups",     icon: Users           },
  { label: "Wallet",      href: "/wallet",     icon: Wallet          },
  { label: "Payouts",     href: "/payouts",    icon: ArrowDownToLine },
  { label: "Settings",    href: "/settings",   icon: Settings        },
]