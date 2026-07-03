import { z } from "zod"

export const fundWalletSchema = z.object({
  amount: z
    .number()
    .min(100, "Minimum funding amount is ₦100"),
})

export type FundWalletValues = z.infer<typeof fundWalletSchema>

export const transferSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .length(10, "Account number must be 10 digits")
    .regex(/^\d+$/, "Account number must contain only digits"),
  amount: z
    .number()
    .min(20, "Amount must be at least ₦20"),
  description: z
    .string()
    .trim()
    .max(140, "Note must be 140 characters or fewer")
    .optional(),
})

export type TransferValues = z.infer<typeof transferSchema>