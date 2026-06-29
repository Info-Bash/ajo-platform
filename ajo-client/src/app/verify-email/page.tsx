"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { AuthLayout } from "@/components/auth/auth-layout"
import { verifyEmailSchema, type VerifyEmailValues } from "@/lib/auth-schemas"
import { useVerifyEmail, useResendOtp } from "@/hooks/use-auth-mutations"

const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailForm />
    </React.Suspense>
  )
}

function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") ?? ""

  const verifyEmail = useVerifyEmail()
  const resendOtp = useResendOtp()

  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN_SECONDS)

  const { control, handleSubmit, watch, setValue } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: "" },
  })

  const code = watch("code")

  React.useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  async function onSubmit(values: VerifyEmailValues) {
    verifyEmail.mutate({ email, code: values.code })
  }

  // Auto-submit on 6 digits
  React.useEffect(() => {
    if (code.length === 6 && !verifyEmail.isPending) {
      handleSubmit(onSubmit)()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  function onResend() {
    if (cooldown > 0) return
    resendOtp.mutate({ email })
    setValue("code", "")
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  return (
    <AuthLayout
      title="Verify your email"
      description={
        email
          ? `Enter the 6-digit code we sent to ${email}`
          : "Enter the 6-digit code we sent to your email"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="code"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={verifyEmail.isPending}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {fieldState.invalid && (
                  <div className="flex justify-center">
                    <FieldError errors={[fieldState.error]} />
                  </div>
                )}
                {verifyEmail.isError && (
                  <div className="flex justify-center">
                    <FieldError>{verifyEmail.error.message}</FieldError>
                  </div>
                )}
              </Field>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={verifyEmail.isPending || code.length !== 6}
          >
            {verifyEmail.isPending ? "Verifying..." : "Verify email"}
          </Button>
        </FieldGroup>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
          <MailCheck className="size-4 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get the code?{" "}
          {cooldown > 0 ? (
            <span>Resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resendOtp.isPending}
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              {resendOtp.isPending ? "Sending..." : "Resend code"}
            </button>
          )}
        </p>
        {resendOtp.isSuccess && (
          <p className="text-xs text-status-paid-text">
            New code sent — check your inbox.
          </p>
        )}
        <Link href="/login" className="text-xs text-muted-foreground hover:underline">
          Back to log in
        </Link>
      </div>
    </AuthLayout>
  )
}