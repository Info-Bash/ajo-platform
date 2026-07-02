import { z } from "zod"

export const fundWalletSchema = z.object({
  amount: z
    .number()
    .min(100, "Minimum funding amount is ₦100"),
})

export type FundWalletValues = z.infer<typeof fundWalletSchema>