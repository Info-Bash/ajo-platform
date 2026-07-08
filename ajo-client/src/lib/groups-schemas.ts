import { z } from "zod"

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80, "Name is too long"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  memberShareAmount: z.number().min(100, "Minimum contribution is ₦100"),
  cycleLength: z
    .number()
    .int()
    .min(2, "A group needs at least 2 members")
    .max(50, "A group cannot have more than 50 members"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "TESTING"]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  activationMode: z.enum(["AUTO_START_WHEN_FULL", "MANUAL_START_BY_ADMIN"]),
  gracePeriodHours: z.number().int().min(1).optional(),
})

export type CreateGroupValues = z.infer<typeof createGroupSchema>

export const requestToJoinSchema = z.object({
  message: z.string().trim().max(300).optional().or(z.literal("")),
})

export type RequestToJoinValues = z.infer<typeof requestToJoinSchema>

export const inviteUserSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .length(10, "Account number must be 10 digits")
    .regex(/^\d+$/, "Account number must contain only digits"),
})

export type InviteUserValues = z.infer<typeof inviteUserSchema>
