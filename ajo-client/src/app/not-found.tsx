import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Catches any URL outside the (dashboard) route group — marketing pages,
 * /login, /register, typos, dead links, etc. No sidebar/topbar here since
 * we don't know if the visitor is authenticated.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <Link href="/" className="mb-8 text-lg font-semibold text-primary">
        Ajo
      </Link>

      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        The page you&apos;re looking for may have been moved or never
        existed. Let&apos;s get you back on track.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  )
}