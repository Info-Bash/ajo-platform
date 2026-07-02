"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Shield, Zap, Users } from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
} from "@/components/ui/avatar"
import ThemeToggle from "@/components/ui/theme-toggle"

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedEvent {
  id: number
  initials: string
  name: string
  action: string
  amount: string
  time: string
  color: string
}

// ─── Activity Feed Data ───────────────────────────────────────────────────────

const FEED_EVENTS: FeedEvent[] = [
  { id: 1, initials: "EO", name: "Emeka O.", action: "contributed to", amount: "₦20,000", time: "just now", color: "#0F766E" },
  { id: 2, initials: "AI", name: "Amaka I.", action: "collected from", amount: "₦160,000", time: "2 min ago", color: "#7C3AED" },
  { id: 3, initials: "CK", name: "Chidi K.", action: "joined circle", amount: "Tech Savers", time: "5 min ago", color: "#0369A1" },
  { id: 4, initials: "NB", name: "Ngozi B.", action: "contributed to", amount: "₦15,000", time: "8 min ago", color: "#B45309" },
  { id: 5, initials: "TI", name: "Tunde I.", action: "collected from", amount: "₦75,000", time: "12 min ago", color: "#DC2626" },
  { id: 6, initials: "FO", name: "Fatima O.", action: "contributed to", amount: "₦10,000", time: "15 min ago", color: "#0F766E" },
]

// ─── Live Activity Feed (signature element) ───────────────────────────────────
// Animates contribution events to make the product feel alive and active.
// Pure CSS animation — no external library.

function ActivityFeed() {
  const [visibleCount, setVisibleCount] = React.useState(3)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((c) => (c < FEED_EVENTS.length ? c + 1 : 3))
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  const visible = FEED_EVENTS.slice(0, visibleCount)

  return (
    <div
      className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-sm"
      style={{ minHeight: 320 }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
            Live activity
          </span>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
          Nigeria
        </span>
      </div>

      {/* Feed rows */}
      <div className="flex flex-col gap-0">
        {visible.map((event, i) => (
          <div
            key={`${event.id}-${visibleCount}`}
            className="flex items-center gap-3 border-b border-white/5 px-5 py-3.5"
            style={{
              animation: i === visible.length - 1 ? "slideInFeed 0.4s ease" : "none",
              opacity: 1 - i * 0.15,
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: event.color }}
            >
              {event.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/90">
                <span className="font-semibold">{event.name}</span>{" "}
                <span className="text-white/60">{event.action}</span>{" "}
                <span className="font-semibold text-emerald-400">{event.amount}</span>
              </p>
            </div>
            <span className="shrink-0 text-xs text-white/40">{event.time}</span>
          </div>
        ))}
      </div>

      {/* Fade-out bottom gradient */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 rounded-b-2xl bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold tracking-tight text-white">
          Ajo<span style={{ color: "#F59E0B" }}>.</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
            style={{ background: "#F59E0B", color: "#1C1917" }}
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* Keyframe for feed animation */}
      <style>{`
        @keyframes slideInFeed {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fadeUp 0.7s ease both; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
      `}</style>

      <div className="min-h-screen bg-background text-foreground">

        {/* ── Hero — dark, full-bleed ── */}
        <section
          className="relative flex min-h-screen flex-col overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0A1628 0%, #0F2744 50%, #0A1628 100%)",
          }}
        >
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(15,118,110,0.25) 0%, transparent 70%)" }}
            aria-hidden="true"
          />

          <Nav />

          {/* Hero content */}
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-16 px-6 pb-20 pt-32 md:flex-row md:gap-20">

            {/* Left: copy */}
            <div className="flex flex-col gap-6 md:max-w-lg">
              <div
                className="animate-fade-up inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}
              >
                Rotating savings circles
              </div>

              <h1
                className="animate-fade-up delay-100 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl"
              >
                The smarter way<br />
                to save{" "}
                <span
                  className="relative inline-block"
                  style={{ color: "#F59E0B" }}
                >
                  with your people.
                </span>
              </h1>

              <p
                className="animate-fade-up delay-200 text-base leading-relaxed md:text-lg"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Ajo turns the trusted West African esusu tradition into a
                modern platform. Pool money with your circle, take turns
                collecting, and reach goals that are impossible alone.
              </p>

              <div className="animate-fade-up delay-300 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: "#0F766E", color: "#fff" }}
                >
                  Start your circle
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-semibold transition-colors"
                  style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}
                >
                  Log in
                </Link>
              </div>

              {/* Social proof avatar strip */}
              <div className="flex items-center gap-3 pt-2">
                <AvatarGroup>
                  {["EO","AI","CK","NB","TI"].map((initials) => (
                    <Avatar key={initials} size="sm">
                      <AvatarFallback className="text-[10px] font-bold" style={{ background: "#0F766E", color: "#fff" }}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </AvatarGroup>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Trusted by growing circles across Nigeria
                </span>
              </div>
            </div>

            {/* Right: live activity feed */}
            <div className="flex w-full max-w-sm flex-col gap-3">
              <ActivityFeed />
              <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Real contributions happening right now
              </p>
            </div>
          </div>

          {/* Bottom wave */}
          <svg
            className="absolute bottom-0 left-0 w-full"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" fill="var(--background)" />
          </svg>
        </section>

        {/* ── What is ajo? ── */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                The concept
              </p>
              <h2 className="mb-5 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                Ajo is savings,<br />reimagined for community.
              </h2>
              <p className="mb-5 text-base leading-relaxed text-text-secondary">
                An ajo circle is a group of trusted people who each contribute
                a fixed amount every cycle. Each cycle, one member collects the
                entire pool — a lump sum that would take months to save alone.
              </p>
              <p className="text-base leading-relaxed text-text-secondary">
                It's been done informally across West Africa for generations.
                We've built the infrastructure to make it secure, transparent,
                and accessible from your phone.
              </p>
            </div>

            {/* Circle visualisation — bold and simple */}
            <div className="flex items-center justify-center">
              <div className="relative flex h-64 w-64 items-center justify-center rounded-full"
                style={{ border: "2px dashed #0F766E33" }}>
                {/* Outer ring members */}
                {[
                  { initials: "EO", angle: 0,   paid: true },
                  { initials: "AI", angle: 60,  paid: true },
                  { initials: "CK", angle: 120, paid: true },
                  { initials: "NB", angle: 180, paid: false },
                  { initials: "TI", angle: 240, paid: false },
                  { initials: "FO", angle: 300, paid: true },
                ].map(({ initials, angle, paid }) => {
                  const rad = (angle - 90) * (Math.PI / 180)
                  const x = 50 + 42 * Math.cos(rad)
                  const y = 50 + 42 * Math.sin(rad)
                  return (
                    <div
                      key={initials}
                      className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        background: paid ? "#0F766E" : "#1E293B",
                        border: paid ? "2px solid #34D399" : "2px solid #334155",
                      }}
                    >
                      {initials}
                    </div>
                  )
                })}
                {/* Centre pool */}
                <div
                  className="flex h-24 w-24 flex-col items-center justify-center rounded-full shadow-xl"
                  style={{ background: "linear-gradient(135deg, #0F766E, #115E59)" }}
                >
                  <span className="text-lg font-extrabold text-white">₦80k</span>
                  <span className="text-[10px] font-medium text-white/70">this round</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="mb-16 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                How it works
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Simple by design.
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  n: "01",
                  title: "Create or join a circle",
                  body: "Set up a savings circle with the people you trust. Define the contribution amount, cycle length, and payout order.",
                  icon: Users,
                },
                {
                  n: "02",
                  title: "Contribute every cycle",
                  body: "Pay your share each cycle directly from your Ajo wallet. Every payment is logged on a transparent double-entry ledger.",
                  icon: Shield,
                },
                {
                  n: "03",
                  title: "Collect when it's your turn",
                  body: "The full pool hits your wallet instantly on your collection day. Use it for anything — school fees, rent, business capital.",
                  icon: Zap,
                },
              ].map(({ n, title, body, icon: Icon }) => (
                <div key={n} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-7">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-4xl font-black leading-none"
                      style={{ color: "#0F766E", opacity: 0.2 }}
                    >
                      {n}
                    </span>
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: "#CCFBF1" }}
                    >
                      <Icon size={18} color="#0F766E" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Ajo over cash ── */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              Why go digital
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Everything cash can't give you.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Full transparency", body: "Every naira in, every naira out — recorded on a double-entry ledger that every member can see." },
              { title: "No missing money", body: "Contributions are locked in your wallet. No one can collect until their legitimate turn arrives." },
              { title: "Instant payouts", body: "Your collection day means money in your wallet that day — not next week when someone finds time." },
              { title: "Conflict-free", body: "The system enforces the rules. No awkward conversations, no chasing people for their share." },
              { title: "Track everything", body: "See exactly who has paid, who is due, and the complete history of every circle you're in." },
              { title: "Powered by Nomba", body: "Built on regulated Nigerian payment infrastructure so your money moves safely and compliantly." },
            ].map(({ title, body }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-border bg-card p-5">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="mb-1 font-semibold text-foreground">{title}</p>
                  <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA strip ── */}
        <section
          className="relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0A1628 0%, #0F2744 100%)" }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, rgba(15,118,110,0.2) 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Your circle is waiting.
            </h2>
            <p className="mx-auto mb-10 max-w-md text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
              Join thousands of Nigerians already using Ajo to save smarter
              and reach their goals together.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold transition-opacity hover:opacity-90"
              style={{ background: "#F59E0B", color: "#1C1917" }}
            >
              Create your free circle
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-8">
            <span className="text-lg font-bold tracking-tight text-foreground">
              Ajo<span className="text-primary">.</span>
            </span>
            <div className="flex items-center gap-6 text-sm text-text-secondary">
              <Link href="/login" className="transition-colors hover:text-foreground">Log in</Link>
              <Link href="/register" className="transition-colors hover:text-foreground">Sign up</Link>
            </div>
            {/* Theme toggle lives here, out of the hero, unobtrusive */}
            <ThemeToggle />
          </div>
        </footer>

      </div>
    </>
  )
}