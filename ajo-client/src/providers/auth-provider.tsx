"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"
import { useRouter } from "next/navigation"
import { apiClient, setToken, clearToken, getToken } from "@/lib/api-client"

// Shape of the user returned by /auth/me
export interface AuthUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  isEmailVerified: boolean
  status: string
  reputationScore: number
  totalGroupsJoined: number
  totalContributionsMade: number
  totalMissedPayments: number
  totalGroupsCompleted: number
  totalGroupsExited: number
  wallet: {
    id: string
    balanceKobo: number
  } | null
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean       // true while fetching /auth/me on initial load
  isAuthenticated: boolean
  /** Call after successful login/register — stores token + sets user */
  onAuthSuccess: (token: string, user?: AuthUser) => Promise<void>
  logout: () => void
  /** Refresh user data from /auth/me (e.g. after profile update) */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true) // starts true — checking token

  // Fetch the current user from /auth/me
  const fetchUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const data = await apiClient.get<AuthUser>("/auth/me")
      setUser(data)
      return data
    } catch {
      // 401 — token invalid/expired, clear it
      clearToken()
      setUser(null)
      return null
    }
  }, [])

  // On mount: if token exists, validate it and load user
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    fetchUser().finally(() => setIsLoading(false))
  }, [fetchUser])

  // Called after any successful auth (login, register, Google, OTP verify)
  const onAuthSuccess = useCallback(
    async (token: string, userData?: AuthUser) => {
      setToken(token)
      if (userData) {
        setUser(userData)
      } else {
        await fetchUser()
      }
    },
    [fetchUser]
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    router.push("/login")
  }, [router])

  const refreshUser = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        onAuthSuccess,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}