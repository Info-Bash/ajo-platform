import { z } from "zod"

// ─── Phone normalization (mirrors backend logic) ──────────────────────────────
// Normalizes Nigerian phone numbers to +234XXXXXXXXXX before validation.
// This ensures 08137413868 and +2348137413868 are treated identically.

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "")

  if (stripped.startsWith("+234")) return stripped
  if (stripped.startsWith("234")) return `+${stripped}`
  if (stripped.startsWith("0")) return `+234${stripped.slice(1)}`
  return stripped // unknown format — let regex catch it
}

const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .transform((val) => normalizePhone(val))
  .refine(
    (val) => /^\+234[0-9]{10}$/.test(val),
    "Enter a valid Nigerian phone number (e.g. 08137413868)"
  )

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    phone: phoneSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type RegisterValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
})

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const verifyEmailSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
})

export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>