"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, Search } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { useWallet, useLookupAccount, useTransfer } from "@/hooks/use-wallet"
import { transferSchema, type TransferValues } from "@/lib/wallet-schemas"
import { formatNaira } from "@/components/wallet/transaction-row"

type Step = "details" | "confirm" | "success"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("")
}

export default function TransferPage() {
  const router = useRouter()
  const { data: wallet } = useWallet()
  const transfer = useTransfer()

  const [step, setStep] = React.useState<Step>("details")
  const [successMessage, setSuccessMessage] = React.useState("")

  const { control, handleSubmit, watch, trigger, formState } =
    useForm<TransferValues>({
      resolver: zodResolver(transferSchema),
      defaultValues: { accountNumber: "", amount: 0, description: "" },
      mode: "onChange",
    })

  const accountNumber = watch("accountNumber") ?? ""
  const amount = watch("amount") ?? 0

  const lookup = useLookupAccount(accountNumber)

  // Step 1 -> 2: only proceed once we've resolved a real recipient.
  async function onContinue() {
    const valid = await trigger()
    if (!valid || !lookup.data) return
    setStep("confirm")
  }

  function onConfirm(values: TransferValues) {
    transfer.mutate(
      {
        accountNumber: values.accountNumber,
        amount: values.amount,
        description: values.description || undefined,
      },
      {
        onSuccess: (data) => {
          setSuccessMessage(data.message)
          setStep("success")
        },
      }
    )
  }

  if (step === "success") {
    return (
      <div className="p-4 pt-6 lg:p-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-status-paid-bg">
            <CheckCircle2 className="size-7 text-status-paid-text" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Transfer sent</h1>
            <p className="mt-1 text-sm text-text-muted">{successMessage}</p>
          </div>
          <div className="mt-4 flex w-full flex-col gap-2">
            <Button className="w-full" asChild>
              <Link href="/wallet">Back to wallet</Link>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setStep("details")
                setSuccessMessage("")
              }}
            >
              Send another transfer
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-md space-y-6">
        <button
          onClick={() => (step === "confirm" ? setStep("details") : router.push("/wallet"))}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {step === "confirm" ? "Edit details" : "Back to wallet"}
        </button>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Transfer</h1>
          {wallet && (
            <p className="text-sm text-text-muted">
              Available balance: {formatNaira(wallet.balance)}
            </p>
          )}
        </div>

        {step === "details" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onContinue()
            }}
          >
            <FieldGroup>
              <Controller
                name="accountNumber"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="accountNumber">
                      Recipient&apos;s account number
                    </FieldLabel>
                    <Input
                      id="accountNumber"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="8620393853"
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(e.target.value.replace(/\D/g, ""))
                      }
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>
                      10-digit Ajo wallet account number.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {/* Recipient preview */}
              {accountNumber.length === 10 && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  {lookup.isPending ? (
                    <>
                      <Search className="size-4 shrink-0 animate-pulse text-text-muted" />
                      <p className="text-sm text-text-muted">Looking up account…</p>
                    </>
                  ) : lookup.isError ? (
                    <p className="text-sm text-destructive">
                      No Ajo account found with that account number.
                    </p>
                  ) : lookup.data ? (
                    <>
                      <Avatar>
                        <AvatarImage src={lookup.data.avatarUrl ?? undefined} />
                        <AvatarFallback>{initials(lookup.data.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {lookup.data.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {lookup.data.accountNumber}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              <Controller
                name="amount"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="amount">Amount (₦)</FieldLabel>
                    <Input
                      id="amount"
                      type="number"
                      min={20}
                      max={wallet?.balance}
                      inputMode="numeric"
                      placeholder="500"
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(e.target.valueAsNumber || 0)
                      }
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                    {wallet && field.value > wallet.balance ? (
                      <FieldError
                        errors={[{ message: "Amount exceeds your available balance" }]}
                      />
                    ) : fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="description">Note (optional)</FieldLabel>
                    <Input
                      id="description"
                      placeholder="For ajo round 3"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !lookup.data ||
                  !formState.isValid ||
                  (wallet ? amount > wallet.balance : false)
                }
              >
                Continue
              </Button>
            </FieldGroup>
          </form>
        )}

        {step === "confirm" && lookup.data && (
          <form onSubmit={handleSubmit(onConfirm)}>
            <FieldGroup>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-text-muted">You&apos;re sending</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                  {formatNaira(amount)}
                </p>

                <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  <Avatar>
                    <AvatarImage src={lookup.data.avatarUrl ?? undefined} />
                    <AvatarFallback>{initials(lookup.data.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {lookup.data.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {lookup.data.accountNumber}
                    </p>
                  </div>
                </div>

                {watch("description") && (
                  <p className="mt-3 border-t border-border pt-3 text-sm text-text-secondary">
                    &ldquo;{watch("description")}&rdquo;
                  </p>
                )}
              </div>

              {transfer.isError && (
                <p className="text-sm text-destructive">{transfer.error.message}</p>
              )}

              <Button type="submit" className="w-full" disabled={transfer.isPending}>
                {transfer.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  `Send ${formatNaira(amount)}`
                )}
              </Button>
            </FieldGroup>
          </form>
        )}
      </div>
    </div>
  )
}