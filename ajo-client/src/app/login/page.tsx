"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { AuthLayout } from "@/components/auth/auth-layout"
import { GoogleIcon } from "@/components/auth/google-icon"
import { PasswordInput } from "@/components/auth/password-input"
import { loginSchema, type LoginValues } from "@/lib/auth-schemas"
import { useLogin } from "@/hooks/use-auth-mutations"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"

// Inner component that uses useSearchParams — must be inside a Suspense boundary
function LoginForm() {
  const login = useLogin()
  const searchParams = useSearchParams()
  const googleError = searchParams.get("error")

  const { control, handleSubmit, setError } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  function onSubmit(values: LoginValues) {
    login.mutate(values, {
      onError: (err) => {
        // Surface server error under the password field only — do NOT also
        // render login.isError below, or the same message shows twice.
        setError("password", { message: err.message })
      },
    })
  }

  // Redirect OAuth flow: just send the browser to the backend's Google
  // entrypoint. No GSI/One Tap involved, so no FedCM deprecation warnings.
  function onGoogleAuth() {
    window.location.href = `${API_BASE_URL}/auth/google`
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Log in to manage your ajo circles"
    >
      <FieldGroup>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogleAuth}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        {googleError && (
          <p className="text-sm text-destructive">{googleError}</p>
        )}

        <FieldSeparator>or</FieldSeparator>

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

            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Logging in..." : "Log in"}
            </Button>
          </FieldGroup>
        </form>
      </FieldGroup>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  )
}