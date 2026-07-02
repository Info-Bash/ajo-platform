"use client"

import Link from "next/link"
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
import { useWallet, useFundWallet } from "@/hooks/use-wallet"
import { fundWalletSchema, type FundWalletValues } from "@/lib/wallet-schemas"

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000]

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function FundWalletPage() {
  const { data: wallet } = useWallet()
  const fundWallet = useFundWallet()

  const { control, handleSubmit, setValue } = useForm<FundWalletValues>({
    resolver: zodResolver(fundWalletSchema),
    defaultValues: { amount: 0 },
  })

  function onSubmit(values: FundWalletValues) {
    fundWallet.mutate(values, {
      onSuccess: (data) => {
        // Nomba's hosted checkout is an external domain — a hard navigation
        // is required here, router.push() won't leave the Next.js app.
        window.location.href = data.checkoutLink
      },
    })
  }

  return (
    <div className="p-4 pt-6 lg:p-8">
      <div className="mx-auto max-w-md space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-foreground">Fund wallet</h1>
          {wallet && (
            <p className="text-sm text-text-muted">
              Current balance: {formatNaira(wallet.balance)}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
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
                    step={100}
                    inputMode="numeric"
                    placeholder="5000"
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(e.target.valueAsNumber || 0)
                    }
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Minimum ₦100. You&apos;ll be redirected to complete payment.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue("amount", amt, { shouldValidate: true })}
                >
                  {formatNaira(amt)}
                </Button>
              ))}
            </div>

            {fundWallet.isError && (
              <p className="text-sm text-destructive">
                {fundWallet.error.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={fundWallet.isPending}>
              {fundWallet.isPending ? "Redirecting to checkout..." : "Continue to payment"}
            </Button>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}