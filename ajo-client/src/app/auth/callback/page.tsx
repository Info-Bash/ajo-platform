"use client"

/**
 * Lands here after the backend's GET /auth/google/callback redirects the
 * browser back with ?token=...&isNewUser=true|false (or ?error=... if the
 * Google flow failed/was cancelled).
 *
 * This page just picks up the token, stores it via the auth provider, and
 * routes the user to the right place — it renders no real UI.
 */

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/providers/auth-provider"

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { onAuthSuccess } = useAuth()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const token = searchParams.get("token")
    const isNewUser = searchParams.get("isNewUser") === "true"
    const errorParam = searchParams.get("error")

    if (errorParam) {
      // Bounce back to login with the error so it can be surfaced there
      router.replace(`/login?error=${encodeURIComponent(errorParam)}`)
      return
    }

    if (!token) {
      setError("No authentication token received. Please try again.")
      return
    }

    onAuthSuccess(token).then(() => {
      router.replace(isNewUser ? "/complete-profile" : "/dashboard")
    })
  }, [searchParams, onAuthSuccess, router])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <a href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to login
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  )
}

// useSearchParams() requires a Suspense boundary in Next.js App Router.
// We wrap the inner component here so the build doesn't bail out.
export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </React.Suspense>
  )
}