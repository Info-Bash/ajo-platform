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

export const withdrawDetailsSchema = z.object({
  bankCode: z.string().min(1, "Select a bank"),
  accountNumber: z
    .string()
    .trim()
    .length(10, "Account number must be 10 digits")
    .regex(/^\d+$/, "Account number must contain only digits"),
  amount: z
    .number()
    .min(100, "Minimum withdrawal amount is ₦100"),
  narration: z
    .string()
    .trim()
    .max(140, "Note must be 140 characters or fewer")
    .optional(),
})

export type WithdrawDetailsValues = z.infer<typeof withdrawDetailsSchema>

export const pinSchema = z.object({
  pin: z
    .string()
    .length(4, "PIN must be 4 digits")
    .regex(/^\d+$/, "PIN must contain only digits"),
})

export type PinValues = z.infer<typeof pinSchema>

export const setPinSchema = z
  .object({
    pin: z.string().length(4, "PIN must be 4 digits").regex(/^\d+$/, "PIN must contain only digits"),
    confirmPin: z.string().length(4, "PIN must be 4 digits").regex(/^\d+$/, "PIN must contain only digits"),
    currentPin: z.string().optional(),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  })

export type SetPinValues = z.infer<typeof setPinSchema>