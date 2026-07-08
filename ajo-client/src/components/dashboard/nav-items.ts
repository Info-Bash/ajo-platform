import type React from "react"
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowDownToLine,
  Settings,
  UserCheck,
  MessageCircle,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",  icon: LayoutDashboard },
  { label: "Ajo Groups",  href: "/groups",     icon: Users           },
  { label: "Messages",    href: "/messages",   icon: MessageCircle   },
  { label: "Friends",     href: "/friends",    icon: UserCheck       },
  { label: "Wallet",      href: "/wallet",     icon: Wallet          },
  { label: "Payouts",     href: "/payouts",    icon: ArrowDownToLine },
  { label: "Settings",    href: "/settings",   icon: Settings        },
]

/** Curated subset for the mobile bottom tab bar — 7 items would be too
 *  cramped at that width. Friends/Payouts/Settings stay reachable via the
 *  desktop sidebar and in-page links (e.g. Friends from the Messages empty state). */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  NAV_ITEMS[0], // Dashboard
  NAV_ITEMS[1], // Ajo Groups
  NAV_ITEMS[2], // Messages
  NAV_ITEMS[4], // Wallet
  NAV_ITEMS[6], // Settings
]