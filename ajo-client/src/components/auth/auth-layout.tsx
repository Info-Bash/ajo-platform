import * as React from "react"
import Link from "next/link"
import { Users } from "lucide-react"

interface AuthLayoutProps {
  /** e.g. "Welcome back" */
  title: string
  /** e.g. "Log in to manage your ajo circles" */
  description: string
  children: React.ReactNode
}

function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      {/* Marketing panel — hidden on mobile, ~40% width on desktop */}
      <div className="relative hidden w-full flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,var(--primary-dark)_0%,var(--primary)_55%,var(--brand-accent)_140%)] p-12 text-primary-foreground lg:flex lg:w-2/5">
        <Link href="/" className="text-xl font-semibold">
          Ajo
        </Link>

        <div className="flex max-w-md flex-col gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/15">
            <Users className="size-6" />
          </div>
          <h2 className="text-3xl font-semibold leading-tight">
            Save together. Withdraw with confidence.
          </h2>
          <p className="text-base text-primary-foreground/80">
            Ajo brings the trusted tradition of group savings circles online —
            track contributions, see who&apos;s next in line, and grow your
            savings with people you trust.
          </p>
        </div>

        <p className="text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} Ajo. All rights reserved.
        </p>
      </div>

      {/* Form panel — full width on mobile, ~60% on desktop, content always centered */}
      <div className="flex w-full flex-1 flex-col items-center justify-center bg-background px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <Link href="/" className="mb-2 text-xl font-semibold text-primary lg:hidden">
              Ajo
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground lg:text-base">
              {description}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export { AuthLayout }