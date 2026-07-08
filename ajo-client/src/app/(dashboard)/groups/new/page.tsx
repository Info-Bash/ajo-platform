"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { useCreateGroup } from "@/hooks/use-groups"
import { createGroupSchema, type CreateGroupValues } from "@/lib/groups-schemas"

const FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "TESTING", label: "Testing (3 min) — dev only" },
]

export default function CreateGroupPage() {
  const router = useRouter()
  const createGroup = useCreateGroup()
  const [serverError, setServerError] = useState<string | null>(null)

  const { control, handleSubmit, watch } = useForm<CreateGroupValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      name: "",
      description: "",
      memberShareAmount: 5000,
      cycleLength: 6,
      frequency: "WEEKLY",
      visibility: "PRIVATE",
      activationMode: "MANUAL_START_BY_ADMIN",
    },
  })

  const memberShare = watch("memberShareAmount")
  const cycleLength = watch("cycleLength")
  const totalPot = (memberShare || 0) * (cycleLength || 0)

  function onSubmit(values: CreateGroupValues) {
    setServerError(null)
    createGroup.mutate(values, {
      onSuccess: (group) => router.push(`/groups/${group.id}`),
      onError: (err) => setServerError(err.message),
    })
  }

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-md space-y-6 pb-10">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to groups
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Create an Ajo circle</h1>
          <p className="text-sm text-text-muted">Set the rules once — everyone joins under them.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="name">Circle name</FieldLabel>
                  <Input id="name" placeholder="Lagos Hustlers Circle" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
                  <Input id="description" placeholder="What's this circle for?" {...field} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="memberShareAmount"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="memberShareAmount">Each member contributes (₦)</FieldLabel>
                  <Input
                    id="memberShareAmount"
                    type="number"
                    min={100}
                    step={100}
                    inputMode="numeric"
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="cycleLength"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="cycleLength">Number of members (= number of rounds)</FieldLabel>
                  <Input
                    id="cycleLength"
                    type="number"
                    min={2}
                    max={50}
                    step={1}
                    inputMode="numeric"
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Total payout each round: ₦{totalPot.toLocaleString("en-NG")}
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="frequency">Contribution frequency</FieldLabel>
                  <select
                    id="frequency"
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </Field>
              )}
            />

            <Controller
              name="visibility"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Who can join?</FieldLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === "PRIVATE" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => field.onChange("PRIVATE")}
                    >
                      Private (invite link)
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "PUBLIC" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => field.onChange("PUBLIC")}
                    >
                      Public (discoverable)
                    </Button>
                  </div>
                  <FieldDescription>
                    {field.value === "PUBLIC"
                      ? "Anyone can find this circle and request to join — you approve each request."
                      : "Only people with your invite link can join."}
                  </FieldDescription>
                </Field>
              )}
            />

            <Controller
              name="activationMode"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>How should it start?</FieldLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === "AUTO_START_WHEN_FULL" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => field.onChange("AUTO_START_WHEN_FULL")}
                    >
                      Auto-start when full
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === "MANUAL_START_BY_ADMIN" ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => field.onChange("MANUAL_START_BY_ADMIN")}
                    >
                      I'll start it manually
                    </Button>
                  </div>
                  <FieldDescription>
                    {field.value === "MANUAL_START_BY_ADMIN"
                      ? "You can start early even before it's full, or wait until everyone's in."
                      : "The rotation begins automatically the moment the last spot fills."}
                  </FieldDescription>
                </Field>
              )}
            />

            {serverError && (
              <p className="text-sm text-destructive" role="alert">{serverError}</p>
            )}

            <Button type="submit" disabled={createGroup.isPending}>
              {createGroup.isPending ? "Creating…" : "Create circle"}
            </Button>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
