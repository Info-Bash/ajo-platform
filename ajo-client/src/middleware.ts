import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/groups",
  "/wallet",
  "/payouts",
  "/settings",
  "/messages",
  "/notifications",
  "/friends",
  "/complete-profile",
]

// Routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/verify-email",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for JWT token in cookies (we'll also set a cookie on login
  // alongside localStorage so middleware can read it)
  const token = request.cookies.get("ajo_access_token")?.value

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  // Not authenticated → redirect to login
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already authenticated → redirect to dashboard
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}