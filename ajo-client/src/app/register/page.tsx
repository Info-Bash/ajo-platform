"use client"

import * as React from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/auth/password-input"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { AuthLayout } from "@/components/auth/auth-layout"
import { GoogleIcon } from "@/components/auth/google-icon"
import { registerSchema, type RegisterValues } from "@/lib/auth-schemas"
import { useRegister } from "@/hooks/use-auth-mutations"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"

export default function RegisterPage() {
  const register = useRegister()

  const { control, handleSubmit } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  })

  function onSubmit(values: RegisterValues) {
    register.mutate({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      password: values.password,
    })
  }

  // Redirect OAuth flow — same backend entrypoint as login. The backend
  // creates the account on the fly if the Google email is new.
  function onGoogleAuth() {
    window.location.href = `${API_BASE_URL}/auth/google`
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start saving with trusted ajo circles"
    >
      <FieldGroup>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onGoogleAuth}
        >
          <GoogleIcon />
          Sign up with Google
        </Button>

        <FieldSeparator>or</FieldSeparator>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="fullName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="Ada Obi"
                    autoComplete="name"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

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
              name="phone"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Phone number</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="tel"
                    placeholder="+234 800 000 0000"
                    autoComplete="tel"
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
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <PasswordInput
                    {...field}
                    id={field.name}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription>
                      At least 8 characters, one uppercase letter and one number
                    </FieldDescription>
                  )}
                </Field>
              )}
            />

            <Controller
              name="confirmPassword"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
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

            {register.isError && (
              <p className="text-sm text-destructive">{register.error.message}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={register.isPending}
            >
              {register.isPending ? "Creating account..." : "Create account"}
            </Button>
          </FieldGroup>
        </form>
      </FieldGroup>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
