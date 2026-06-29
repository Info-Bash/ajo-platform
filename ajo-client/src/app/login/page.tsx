"use client"

import * as React from "react"
import Link from "next/link"
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
import { useLogin, useGoogleAuth } from "@/hooks/use-auth-mutations"

export default function LoginPage() {
  const login = useLogin()
  const googleAuth = useGoogleAuth()

  const { control, handleSubmit, setError } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    login.mutate(values, {
      onError: (err) => {
        // Surface server error under the password field
        setError("password", { message: err.message })
      },
    })
  }

  async function onGoogleAuth() {
    try {
      // Load Google Identity Services SDK and get idToken
      const { google } = window as unknown as {
        google: {
          accounts: {
            id: {
              initialize: (config: object) => void
              prompt: () => void
            }
          }
        }
      }

      google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        callback: (response: { credential: string }) => {
          googleAuth.mutate(
            { idToken: response.credential },
            { onError: (err) => alert(err.message) }
          )
        },
      })
      google.accounts.id.prompt()
    } catch {
      alert("Google sign-in failed. Please try again.")
    }
  }

  const isSubmitting = login.isPending

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
          disabled={googleAuth.isPending}
        >
          <GoogleIcon />
          {googleAuth.isPending ? "Connecting..." : "Continue with Google"}
        </Button>

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

            {/* Server-level error (wrong credentials etc.) */}
            {login.isError && (
              <p className="text-sm text-destructive">{login.error.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Log in"}
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