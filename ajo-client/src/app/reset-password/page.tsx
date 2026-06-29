"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { PasswordInput } from "@/components/auth/password-input"
import { AuthLayout } from "@/components/auth/auth-layout"
import { useResetPassword } from "@/hooks/use-auth-mutations"

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const email = searchParams.get("email") ?? ""

  const resetPassword = useResetPassword()
  const [success, setSuccess] = React.useState(false)

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  // Missing token or email in URL — show an error state
  if (!token || !email) {
    return (
      <AuthLayout
        title="Invalid reset link"
        description="This password reset link is invalid or has expired"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Request a new link from the forgot password page.
          </p>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request new link</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout
        title="Password reset"
        description="Your password has been updated successfully"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-status-paid-bg">
            <CheckCircle className="size-5 text-status-paid" />
          </div>
          <p className="text-sm text-muted-foreground">
            You can now log in with your new password.
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Go to log in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  function onSubmit(values: FormValues) {
    resetPassword.mutate(
      { email, token, newPassword: values.newPassword },
      { onSuccess: () => setSuccess(true) },
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter a new password for your account"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="newPassword"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                <PasswordInput
                  {...field}
                  id={field.name}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="confirmPassword"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Confirm new password</FieldLabel>
                <PasswordInput
                  {...field}
                  id={field.name}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          {resetPassword.isError && (
            <p className="text-sm text-destructive">
              {resetPassword.error.message}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={resetPassword.isPending}
          >
            {resetPassword.isPending ? "Resetting..." : "Reset password"}
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