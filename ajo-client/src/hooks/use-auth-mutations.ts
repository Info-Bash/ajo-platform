import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/providers/auth-provider"

// ─── Response shapes from backend ────────────────────────────────────────────

interface AuthResponse {
  accessToken: string
  user: {
    id: string
    fullName: string
    email: string
    phone: string | null
    avatarUrl: string | null
    isEmailVerified: boolean
    reputationScore: number
  }
}

interface GoogleAuthResponse extends AuthResponse {
  isNewUser: boolean
}

interface MessageResponse {
  message: string
  email?: string
}

interface OtpVerifyResponse {
  message: string
  accessToken: string
}

// ─── Register ─────────────────────────────────────────────────────────────────

interface RegisterPayload {
  fullName: string
  email: string
  phone: string
  password: string
}

export function useRegister() {
  const router = useRouter()

  return useMutation<MessageResponse, Error, RegisterPayload>({
    mutationFn: (data) =>
      apiClient.post<MessageResponse>("/auth/register", data, {
        skipAuth: true,
      }),
    onSuccess: (_data, variables) => {
      // Navigate to verify-email page with email in query param
      router.push(
        `/verify-email?email=${encodeURIComponent(variables.email)}`
      )
    },
  })
}

// ─── Verify Email OTP ─────────────────────────────────────────────────────────

interface VerifyOtpPayload {
  email: string
  code: string
}

export function useVerifyEmail() {
  const { onAuthSuccess } = useAuth()
  const router = useRouter()

  return useMutation<OtpVerifyResponse, Error, VerifyOtpPayload>({
    mutationFn: (data) =>
      apiClient.post<OtpVerifyResponse>("/auth/verify-email", data, {
        skipAuth: true,
      }),
    onSuccess: async (data) => {
      // Auto-login after verification
      await onAuthSuccess(data.accessToken)
      router.push("/dashboard")
    },
  })
}

// ─── Resend OTP ───────────────────────────────────────────────────────────────

export function useResendOtp() {
  return useMutation<MessageResponse, Error, { email: string }>({
    mutationFn: (data) =>
      apiClient.post<MessageResponse>("/auth/resend-otp", data, {
        skipAuth: true,
      }),
  })
}

// ─── Login ────────────────────────────────────────────────────────────────────

interface LoginPayload {
  email: string
  password: string
}

export function useLogin() {
  const { onAuthSuccess } = useAuth()
  const router = useRouter()

  return useMutation<AuthResponse, Error, LoginPayload>({
    mutationFn: (data) =>
      apiClient.post<AuthResponse>("/auth/login", data, { skipAuth: true }),
    onSuccess: async (data) => {
      await onAuthSuccess(data.accessToken, data.user as Parameters<typeof onAuthSuccess>[1])
      router.push("/dashboard")
    },
  })
}

// ─── Google Auth ──────────────────────────────────────────────────────────────

export function useGoogleAuth() {
  const { onAuthSuccess } = useAuth()
  const router = useRouter()

  return useMutation<GoogleAuthResponse, Error, { idToken: string }>({
    mutationFn: (data) =>
      apiClient.post<GoogleAuthResponse>("/auth/google", data, {
        skipAuth: true,
      }),
    onSuccess: async (data) => {
      await onAuthSuccess(data.accessToken, data.user as Parameters<typeof onAuthSuccess>[1])
      if (data.isNewUser) {
        // New Google user — needs to add phone number
        router.push("/complete-profile")
      } else {
        router.push("/dashboard")
      }
    },
  })
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export function useForgotPassword() {
  return useMutation<MessageResponse, Error, { email: string }>({
    mutationFn: (data) =>
      apiClient.post<MessageResponse>("/auth/forgot-password", data, {
        skipAuth: true,
      }),
  })
}

// ─── Reset Password ───────────────────────────────────────────────────────────

interface ResetPasswordPayload {
  email: string
  token: string
  newPassword: string
}

export function useResetPassword() {
  const router = useRouter()

  return useMutation<MessageResponse, Error, ResetPasswordPayload>({
    mutationFn: (data) =>
      apiClient.post<MessageResponse>("/auth/reset-password", data, {
        skipAuth: true,
      }),
    onSuccess: () => {
      router.push("/login")
    },
  })
}

// ─── Complete Profile (Google users adding phone) ─────────────────────────────

export function useCompleteProfile() {
  const { refreshUser } = useAuth()
  const router = useRouter()

  return useMutation<{ message: string; user: unknown }, Error, { phone: string }>({
    mutationFn: (data) =>
      apiClient.patch<{ message: string; user: unknown }>(
        "/auth/complete-profile",
        data
      ),
    onSuccess: async () => {
      await refreshUser()
      router.push("/dashboard")
    },
  })
}