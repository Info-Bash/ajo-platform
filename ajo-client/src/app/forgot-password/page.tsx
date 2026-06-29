"use client"

import * as React from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { AuthLayout } from "@/components/auth/auth-layout"
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth-schemas"
import { useForgotPassword } from "@/hooks/use-auth-mutations"

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword()
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null)

  const { control, handleSubmit } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  function onSubmit(values: ForgotPasswordValues) {
    forgotPassword.mutate(values, {
      onSuccess: () => setSubmittedEmail(values.email),
    })
  }

  if (submittedEmail) {
    return (
      <AuthLayout
        title="Check your email"
        description="We've sent password reset instructions"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
            <Mail className="size-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            If an account exists for{" "}
            <span className="font-medium text-foreground">{submittedEmail}</span>,
            you&apos;ll receive a password reset link shortly.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="text-sm"
            onClick={() => setSubmittedEmail(null)}
          >
            Use a different email
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {forgotPassword.isError && (
            <p className="text-sm text-destructive">
              {forgotPassword.error.message}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={forgotPassword.isPending}
          >
            {forgotPassword.isPending ? "Sending..." : "Send reset link"}
          </Button>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  )
}