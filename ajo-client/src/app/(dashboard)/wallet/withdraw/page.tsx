"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Landmark,
  Loader2,
  Plus,
} from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { BankPickerDialog } from "@/components/wallet/bank-picker-dialog"
import { formatNaira } from "@/components/wallet/transaction-row"
import {
  useWallet,
  useBeneficiaries,
  useBankList,
  useResolveBankAccount,
  useSetTransactionPin,
  useWithdraw,
  type Beneficiary,
} from "@/hooks/use-wallet"
import {
  withdrawDetailsSchema,
  type WithdrawDetailsValues,
  setPinSchema,
  type SetPinValues,
} from "@/lib/wallet-schemas"

type Step = "set-pin" | "details" | "confirm" | "success"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("")
}

export default function WithdrawPage() {
  const router = useRouter()
  const wallet = useWallet()
  const beneficiaries = useBeneficiaries()
  const banks = useBankList()

  const [step, setStep] = React.useState<Step>("details")
  // Once we know whether a PIN exists, route to the right starting step.
  const [stepInitialized, setStepInitialized] = React.useState(false)
  React.useEffect(() => {
    if (stepInitialized || !wallet.data) return
    setStep(wallet.data.hasTransactionPin ? "details" : "set-pin")
    setStepInitialized(true)
  }, [wallet.data, stepInitialized])

  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [showNewAccount, setShowNewAccount] = React.useState(false)
  const [selectedBeneficiary, setSelectedBeneficiary] = React.useState<Beneficiary | null>(null)
  const [pin, setPin] = React.useState("")
  const [successData, setSuccessData] = React.useState<{
    message: string
    status: "SUCCESSFUL" | "PENDING"
  } | null>(null)

  const setTransactionPin = useSetTransactionPin()
  const withdraw = useWithdraw()

  const { control, handleSubmit, watch, trigger, setValue, formState } =
    useForm<WithdrawDetailsValues>({
      resolver: zodResolver(withdrawDetailsSchema),
      defaultValues: { bankCode: "", accountNumber: "", amount: 0, narration: "" },
      mode: "onChange",
    })

  const bankCode = watch("bankCode")
  const accountNumber = watch("accountNumber")
  const amount = watch("amount") ?? 0

  const resolve = useResolveBankAccount(accountNumber, bankCode)
  const selectedBank = banks.data?.find((b) => b.code === bankCode)

  const {
    control: pinControl,
    handleSubmit: handlePinSubmit,
    watch: watchPin,
  } = useForm<SetPinValues>({
    resolver: zodResolver(setPinSchema),
    defaultValues: { pin: "", confirmPin: "" },
  })
  const newPin = watchPin("pin")
  const confirmPin = watchPin("confirmPin")

  function pickBeneficiary(b: Beneficiary) {
    setSelectedBeneficiary(b)
    setShowNewAccount(false)
    setValue("bankCode", b.bankCode ?? "", { shouldValidate: true })
    setValue("accountNumber", b.accountNumber, { shouldValidate: true })
  }

  function startNewAccount() {
    setSelectedBeneficiary(null)
    setShowNewAccount(true)
    setValue("bankCode", "", { shouldValidate: true })
    setValue("accountNumber", "", { shouldValidate: true })
  }

  async function onContinue() {
    const valid = await trigger()
    if (!valid || !resolve.data) return
    setStep("confirm")
  }

  function onSetPin(values: SetPinValues) {
    setTransactionPin.mutate(
      { pin: values.pin },
      { onSuccess: () => setStep("details") }
    )
  }

  function onConfirm(values: WithdrawDetailsValues) {
    if (pin.length !== 4) return
    withdraw.mutate(
      {
        amount: values.amount,
        narration: values.narration || undefined,
        accountNumber: values.accountNumber,
        bankCode: values.bankCode,
        pin,
      },
      {
        onSuccess: (data) => {
          setSuccessData({ message: data.message, status: data.status })
          setStep("success")
        },
        onError: () => setPin(""),
      }
    )
  }

  // ─── Success ────────────────────────────────────────────────────────────

  if (step === "success" && successData) {
    const pending = successData.status === "PENDING"
    return (
      <div className="p-4 pt-6 lg:p-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-10 text-center">
          <div
            className={
              pending
                ? "flex size-14 items-center justify-center rounded-full bg-status-pending-bg"
                : "flex size-14 items-center justify-center rounded-full bg-status-paid-bg"
            }
          >
            {pending ? (
              <Clock className="size-7 text-status-pending-text" />
            ) : (
              <CheckCircle2 className="size-7 text-status-paid-text" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {pending ? "Withdrawal processing" : "Withdrawal sent"}
            </h1>
            <p className="mt-1 text-sm text-text-muted">{successData.message}</p>
            {pending && (
              <p className="mt-2 text-xs text-text-muted">
                Your wallet has already been debited. This will confirm shortly —
                check your transaction history for the final status.
              </p>
            )}
          </div>
          <div className="mt-4 flex w-full flex-col gap-2">
            <Button className="w-full" asChild>
              <Link href="/wallet">Back to wallet</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Loading gate (need wallet.data to know which step to start on) ──────

  if (!stepInitialized) {
    return (
      <div className="p-4 pt-6 lg:p-8">
        <div className="mx-auto flex max-w-md items-center justify-center pt-20">
          <Loader2 className="size-5 animate-spin text-text-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-md space-y-6">
        <button
          onClick={() =>
            step === "confirm" ? setStep("details") : router.push("/wallet")
          }
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {step === "confirm" ? "Edit details" : "Back to wallet"}
        </button>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Withdraw</h1>
          {wallet.data && (
            <p className="text-sm text-text-muted">
              Available balance: {formatNaira(wallet.data.balance)}
            </p>
          )}
        </div>

        {/* ─── Set PIN (first-time only) ─────────────────────────────── */}
        {step === "set-pin" && (
          <form onSubmit={handlePinSubmit(onSetPin)}>
            <FieldGroup>
              <p className="text-sm text-text-secondary">
                Set a 4-digit transaction PIN. You&apos;ll need it to confirm
                withdrawals.
              </p>

              <Controller
                name="pin"
                control={pinControl}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>PIN</FieldLabel>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={4}
                        value={field.value}
                        onChange={field.onChange}
                        disabled={setTransactionPin.isPending}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </Field>
                )}
              />

              <Controller
                name="confirmPin"
                control={pinControl}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Confirm PIN</FieldLabel>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={4}
                        value={field.value}
                        onChange={field.onChange}
                        disabled={setTransactionPin.isPending}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {fieldState.invalid && (
                      <div className="flex justify-center">
                        <FieldError errors={[fieldState.error]} />
                      </div>
                    )}
                  </Field>
                )}
              />

              {setTransactionPin.isError && (
                <p className="text-center text-sm text-destructive">
                  {setTransactionPin.error.message}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  setTransactionPin.isPending ||
                  newPin.length !== 4 ||
                  confirmPin.length !== 4
                }
              >
                {setTransactionPin.isPending ? "Saving…" : "Set PIN"}
              </Button>
            </FieldGroup>
          </form>
        )}

        {/* ─── Details ────────────────────────────────────────────────── */}
        {step === "details" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onContinue()
            }}
          >
            <FieldGroup>
              {beneficiaries.data && beneficiaries.data.length > 0 && !showNewAccount && (
                <Field>
                  <FieldLabel>Saved accounts</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {beneficiaries.data.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => pickBeneficiary(b)}
                        className={
                          "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors " +
                          (selectedBeneficiary?.id === b.id
                            ? "border-primary bg-primary-soft"
                            : "border-border bg-card hover:bg-accent")
                        }
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                          {initials(b.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                          <p className="text-xs text-text-muted">
                            {b.bankName} · {b.accountNumber}
                          </p>
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={startNewAccount}
                      className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-text-muted transition-colors hover:border-foreground hover:text-foreground"
                    >
                      <Plus className="size-4" />
                      Withdraw to a new account
                    </button>
                  </div>
                </Field>
              )}

              {(showNewAccount || !beneficiaries.data?.length) && (
                <>
                  <Controller
                    name="bankCode"
                    control={control}
                    render={({ fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Bank</FieldLabel>
                        <button
                          type="button"
                          onClick={() => setPickerOpen(true)}
                          className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-accent"
                        >
                          <Landmark className="size-4 shrink-0 text-text-muted" />
                          <span className={selectedBank ? "text-foreground" : "text-text-muted"}>
                            {selectedBank ? selectedBank.name : "Select bank"}
                          </span>
                        </button>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="accountNumber"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="accountNumber">Account number</FieldLabel>
                        <Input
                          id="accountNumber"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="0554772814"
                          value={field.value}
                          onChange={(e) => {
                            setSelectedBeneficiary(null)
                            field.onChange(e.target.value.replace(/\D/g, ""))
                          }}
                          onBlur={field.onBlur}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  {/* Recipient preview */}
                  {accountNumber.length === 10 && bankCode && (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                      {resolve.isPending ? (
                        <p className="text-sm text-text-muted">Verifying account…</p>
                      ) : resolve.isError ? (
                        <p className="text-sm text-destructive">
                          {resolve.error.message || "Could not verify that account number."}
                        </p>
                      ) : resolve.data ? (
                        <>
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                            {initials(resolve.data.accountName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {resolve.data.accountName}
                            </p>
                            <p className="text-xs text-text-muted">{resolve.data.accountNumber}</p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </>
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
                      min={100}
                      max={wallet.data?.balance}
                      inputMode="numeric"
                      placeholder="5000"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                    {wallet.data && field.value > wallet.data.balance ? (
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
                name="narration"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="narration">Note (optional)</FieldLabel>
                    <Input
                      id="narration"
                      placeholder="Rent payout"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={
                  !resolve.data ||
                  !formState.isValid ||
                  (wallet.data ? amount > wallet.data.balance : false)
                }
              >
                Continue
              </Button>
            </FieldGroup>
          </form>
        )}

        {/* ─── Confirm ────────────────────────────────────────────────── */}
        {step === "confirm" && resolve.data && (
          <form onSubmit={handleSubmit(onConfirm)}>
            <FieldGroup>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-text-muted">You&apos;re withdrawing</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                  {formatNaira(amount)}
                </p>

                <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                    {initials(resolve.data.accountName)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {resolve.data.accountName}
                    </p>
                    <p className="text-xs text-text-muted">
                      {selectedBank?.name} · {resolve.data.accountNumber}
                    </p>
                  </div>
                </div>

                {watch("narration") && (
                  <p className="mt-3 border-t border-border pt-3 text-sm text-text-secondary">
                    &ldquo;{watch("narration")}&rdquo;
                  </p>
                )}
              </div>

              <Field>
                <FieldLabel>Enter your transaction PIN</FieldLabel>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={4}
                    value={pin}
                    onChange={setPin}
                    disabled={withdraw.isPending}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </Field>

              {withdraw.isError && (
                <p className="text-center text-sm text-destructive">{withdraw.error.message}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={withdraw.isPending || pin.length !== 4}
              >
                {withdraw.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  `Withdraw ${formatNaira(amount)}`
                )}
              </Button>
            </FieldGroup>
          </form>
        )}
      </div>

      <BankPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={bankCode}
        onSelect={(bank) => {
          setSelectedBeneficiary(null)
          setValue("bankCode", bank.code, { shouldValidate: true })
        }}
      />
    </div>
  )
}
