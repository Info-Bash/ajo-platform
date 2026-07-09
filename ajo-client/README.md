# Ajo Client

Frontend for **Ajo** — a digital rotating-savings (ajo) platform. Next.js
(App Router) + React Query + Tailwind v4, talking to the [Ajo Server](../ajo-server) API.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Runs on `http://localhost:3000` by default.

### Environment variables

| Variable | Default if unset | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api/v1` | Base URL of the Ajo Server API |
| `NEXT_PUBLIC_SOCKET_URL` | Derived from `NEXT_PUBLIC_API_URL`'s origin | Only set this separately if your socket server lives on a different host than the REST API |

---

## Project structure

```
src/
  app/
    (auth pages)              login, register, verify-email, forgot/reset-password, complete-profile
    (dashboard)/               everything behind auth, wrapped in the dashboard shell
      dashboard/                home — stats, next contribution/payout, groups grid
      groups/                   list mine, /new (create), /discover (public), /join (invite code), /[id] (detail: members/schedule/chat tabs)
      friends/                  friends list
      messages/                 conversation inbox, /[userId] (thread)
      wallet/                   balance, /fund, /withdraw, /transfer
  components/
    ui/                        shared primitives (button, input, tabs, select, dialog, field, ...)
    ajo/                       domain components (circle-card, group-chat-panel, group-schedule-panel, ...)
    dashboard/                 shell (topbar, sidebar, bottom tab bar) + dashboard-specific sections
  hooks/                       one file per domain — use-groups, use-chat, use-friends,
                                use-direct-messages, use-contributions, use-wallet, use-dashboard
                                (also owns the shared React Query `queryKeys`)
  lib/
    api-client.ts               fetch wrapper, throws typed ApiError on non-2xx
    types.ts                    all shared frontend types
    *-schemas.ts                 zod validation schemas per form
  providers/
    auth-provider.tsx            current user context
    socket-provider.tsx          Socket.IO connection + SOCKET_EVENTS + useSocket()
    query-provider.tsx           React Query client
```

## Conventions worth knowing before editing

- **Hooks own the backend↔frontend mapping.** Every `use-*.ts` hook file maps
  the raw backend shape (kobo amounts, `SCREAMING_CASE` enums) to the
  frontend's `types.ts` shape (naira, `lowercase` enums) locally in that file
  — components never see raw backend JSON.
- **`queryKeys` is centralized** in `hooks/use-dashboard.ts` so cache
  invalidation stays consistent across features that touch the same data
  (e.g. paying a contribution invalidates the group, the schedule, *and* the
  wallet).
- **Realtime hooks** (`useRealtimeGroupChat`, `useRealtimeDirectMessages`,
  `useRealtimeWallet`) join a socket room on mount and patch the relevant
  React Query cache directly on incoming events — they don't refetch.
- **Tailwind v4**: prefer bracket syntax (`data-[state=active]:...`) over bare
  `data-active:` classes. Bare custom-variant classes require a matching
  `@custom-variant` declaration in `globals.css` to work at all, which is
  easy to get wrong (see `components/ui/tabs.tsx`'s history) — bracket syntax
  needs no configuration and just works.
- **Page shell heights**: the dashboard layout reserves `pt-14` for the fixed
  topbar and `pb-20`/`lg:pb-0` for the fixed mobile bottom tab bar
  (`components/dashboard/dashboard-auth-guard.tsx`). Any page that pins its
  own header/footer to the viewport (like the DM thread) must account for
  *both* in its height calc, or content ends up hidden behind the bottom bar.

---

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint
```
