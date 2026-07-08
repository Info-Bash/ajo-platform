"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useJoinByInviteCode } from "@/hooks/use-groups"

export default function JoinGroupPage() {
  return (
    <Suspense fallback={null}>
      <JoinGroupForm />
    </Suspense>
  )
}

function JoinGroupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const joinByCode = useJoinByInviteCode()

  useEffect(() => {
    const fromLink = searchParams.get("code")
    if (fromLink) setCode(fromLink.toUpperCase())
  }, [searchParams])

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    joinByCode.mutate(code.trim().toUpperCase(), {
      onSuccess: () => router.push("/groups"),
      onError: (err) => setError(err.message),
    })
  }

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-md space-y-6">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to groups
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Join with an invite link</h1>
          <p className="text-sm text-text-muted">
            Enter the invite code someone shared with you to join their private circle instantly.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="code">Invite code</FieldLabel>
            <Input
              id="code"
              placeholder="ABCD2345"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="tracking-widest uppercase"
            />
            <FieldDescription>8 characters, from the link your friend shared.</FieldDescription>
          </Field>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <Button type="submit" className="w-full" disabled={!code.trim() || joinByCode.isPending}>
            {joinByCode.isPending ? "Joining…" : "Join circle"}
          </Button>
        </form>

        <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary-soft">
            <Search className="size-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Don't have a link?</p>
          <p className="mt-0.5 text-xs text-text-muted">Browse public circles looking for members.</p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/groups/discover">Discover public circles</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
