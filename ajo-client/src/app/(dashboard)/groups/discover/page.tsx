"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usePublicGroups, useRequestToJoin } from "@/hooks/use-groups"
import { toast } from "sonner"
import type { AjoGroup } from "@/lib/types"

function DiscoverCard({ group }: { group: AjoGroup }) {
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState("")
  const requestToJoin = useRequestToJoin(group.id)
  const requested = requestToJoin.isSuccess

  function submit() {
    requestToJoin.mutate(
      { message: message.trim() || undefined },
      {
        onSuccess: () => toast.success("Request sent! The admin will review it."),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-foreground">{group.name}</h3>
          <p className="text-sm text-text-muted">
            ₦{group.memberShare.toLocaleString("en-NG")} / {group.frequency}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
          <Users className="size-3.5" />
          {group.memberCount}/{group.cycleLength}
        </span>
      </div>

      {group.description && <p className="mt-2 text-sm text-text-muted">{group.description}</p>}

      {!showForm && !requested && (
        <Button size="sm" className="mt-3" onClick={() => setShowForm(true)}>
          Request to join
        </Button>
      )}

      {requested && (
        <p className="mt-3 text-sm font-medium text-primary">Request sent — waiting on admin approval</p>
      )}

      {showForm && !requested && (
        <div className="mt-3 space-y-2">
          <Field>
            <FieldLabel htmlFor={`msg-${group.id}`}>Message to the admin (optional)</FieldLabel>
            <Input
              id={`msg-${group.id}`}
              placeholder="Hi, I'd love to join!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={requestToJoin.isPending}>
              {requestToJoin.isPending ? "Sending…" : "Send request"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DiscoverGroupsPage() {
  const { data, isPending } = usePublicGroups()

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6 pb-10">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to groups
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Discover public circles</h1>
          <p className="text-sm text-text-muted">Still gathering members — request to join one that fits you.</p>
        </div>

        {isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : data && data.groups.length > 0 ? (
          <div className="space-y-3">
            {data.groups.map((group) => (
              <DiscoverCard key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card py-10 text-center">
            <p className="font-medium text-foreground">No public circles right now</p>
            <p className="mt-0.5 text-sm text-text-muted">Check back later, or create your own!</p>
          </div>
        )}
      </div>
    </div>
  )
}
