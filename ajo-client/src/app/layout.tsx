import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Inter, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import Script from "next/script"
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ajo — Save Together",
  description: "Digital savings circles, built on trust.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/*
            QueryProvider wraps everything — TanStack Query works app-wide.
            AuthProvider sits inside QueryProvider so auth mutations can use
            the same query client (e.g. invalidate user cache on logout).
          */}
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        {/* Google Identity Services SDK — loaded once for the whole app */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="lazyOnload"
        />
      </body>
    </html>
  )
}