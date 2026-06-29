"use client"

import * as React from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { AuthLayout } from "@/components/auth/auth-layout"
import { useCompleteProfile } from "@/hooks/use-auth-mutations"
import { useAuth } from "@/providers/auth-provider"

const schema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^\+?[0-9]{10,14}$/, "Enter a valid phone number"),
})

type FormValues = z.infer<typeof schema>

export default function CompleteProfilePage() {
  const { user } = useAuth()
  const completeProfile = useCompleteProfile()

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" },
  })

  function onSubmit(values: FormValues) {
    completeProfile.mutate(values)
  }

  return (
    <AuthLayout
      title="One last step"
      description="Add your phone number to complete your Ajo profile"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          {user?.fullName && (
            <p className="text-sm text-muted-foreground text-center -mt-2 mb-2">
              Welcome, {user.fullName.split(" ")[0]}!
            </p>
          )}

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

          {completeProfile.isError && (
            <p className="text-sm text-destructive">
              {completeProfile.error.message}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={completeProfile.isPending}
          >
            {completeProfile.isPending ? "Saving..." : "Complete profile"}
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}