# Ajo Server

Backend API for **Ajo** — a digital rotating-savings (ajo) platform. Members
form circles, contribute on a schedule, and take turns receiving the pooled payout,
with group chat, direct messaging, and auto-friending built on top.

Built with **NestJS 10 + Prisma + PostgreSQL**, real-time features via **Socket.IO**,
and payments via **Nomba**.

> Full endpoint reference is auto-generated — once the server is running, open
> **`/api/v1/docs`** for interactive Swagger docs.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | NestJS 10 |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (Passport), Google OAuth |
| Realtime | Socket.IO (`@nestjs/websockets`) |
| Payments | Nomba (virtual accounts, transfers, webhooks) |
| Scheduling | `@nestjs/schedule` (cron) |
| Docs | Swagger / OpenAPI |

---

## Getting started

### 1. Install & configure

```bash
npm install
cp .env.example .env   # then fill in the values below
```

### Required environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (**required**) |
| `JWT_SECRET` | Signs access tokens — min 32 characters (**required**) |
| `JWT_EXPIRES_IN` | Default `7d` |
| `NODE_ENV` | `development` \| `staging` \| `production` — gates the dev-only `TESTING` contribution frequency |
| `PORT` | Default `3001` |
| `FRONTEND_URL` | Used for CORS + building invite/reset links |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `NOMBA_API_KEY` / `NOMBA_SECRET_KEY` | Nomba API credentials |
| `NOMBA_BASE_URL` | Default `https://api.nomba.com/v1` |
| `NOMBA_ACCOUNT_ID` / `NOMBA_SUB_ACCOUNT_ID` | Nomba account identifiers |
| `NOMBA_WEBHOOK_SIGNATURE_KEY` | Validates incoming Nomba webhooks |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` | SMTP credentials for verification/reset emails |
| `MAIL_FROM` / `MAIL_FROM_NAME` | Sender identity on outgoing emails |

Everything except `DATABASE_URL` and `JWT_SECRET` has a sensible default or
degrades gracefully (e.g. empty Nomba keys just mean payment features won't
work) — see `src/config/app.config.ts` for the full Joi validation schema.
The app refuses to boot if a required variable is missing or malformed.

### 2. Set up the database

```bash
npx prisma migrate dev   # applies migrations + generates the Prisma client
```

### 3. Run it

```bash
npm run start:dev     # watch mode
npm run build && npm run start:prod   # production
```

The API is served under the `/api/v1` prefix, e.g. `http://localhost:3001/api/v1`.

---

## Architecture

Each domain is its own Nest module under `src/`:

| Module | Responsibility |
|---|---|
| `auth` | Register/login, email verification, Google OAuth, JWT guard |
| `wallet` | Virtual accounts (Nomba), fund/withdraw/transfer, transaction ledger |
| `groups` | Ajo group lifecycle — create, discover, join (invite link / request+approve), activation, membership |
| `contributions` | Per-round contribution payments, reminders, late/default tracking, round progression (cron-driven) |
| `payouts` | Releases the collected pot to a round's recipient (or withholds it if they've defaulted) |
| `chat` | Per-group chat, plus automatic system messages ("member joined", "payout released", etc.) |
| `friends` | Auto-friending between co-members of a group |
| `direct-messages` | 1:1 messaging between friends |
| `dashboard` | Aggregated home-screen summary (wallet + groups + next contribution/payout) |
| `realtime` | Socket.IO gateway — per-user rooms (`user:<id>`) and per-group rooms (`group:<id>`) |
| `webhooks` | Nomba payment webhook handling |
| `mail` | Transactional email (verification, password reset) |
| `nomba` | Nomba API client wrapper |
| `prisma` | Database client (global module) |
| `common` | Shared guards, decorators, filters, utils |

### Key design decisions

- **Groups are fixed-size rotations.** `cycleLength` set at creation = both the
  target member count and the number of rounds. Payout order is FIFO by join
  order, locked in the instant someone joins (not deferred to activation).
- **Two activation modes**, chosen by the creator: `AUTO_START_WHEN_FULL` or
  `MANUAL_START_BY_ADMIN`. A manual start before the group is full shrinks
  `cycleLength`/the pot to the actual member count — each member still pays
  the rate they signed up for.
- **Public vs private groups**: private groups join instantly via invite
  code/link; public groups go through a join-request → admin-approval flow
  and are listed on the discovery page while `PENDING`.
- **Contribution engine is cron-driven** (`ContributionsCronService`, runs
  every minute): posts a reminder mid-round, flips `PENDING → LATE` past the
  due date, flips `LATE → DEFAULTED` past the grace period, and finalizes a
  round (releases the payout, opens the next round) the instant every
  contribution in it is resolved.
- **Payout = actual amount collected**, not the theoretical full pot — if
  someone defaults, the recipient gets a smaller payout rather than the group
  absorbing the shortfall. If the recipient themselves has since defaulted or
  exited, the payout is recorded as withheld rather than paid out, pending
  manual review (no auto-redistribution yet).
- **Dev-only `TESTING` frequency**: 3-minute rounds with a 1-minute grace
  period, so the whole contribution → late → default → payout cycle can be
  exercised in minutes. Rejected outside `development`/`staging`
  (`NODE_ENV=production` blocks it) — safe to delete entirely before a real launch.
- **Double-entry ledger**: every wallet movement (fund, withdraw, transfer,
  contribution, payout) writes two `Transaction` rows sharing a `journalId`,
  debit and credit, so balances are always reconcilable.

### Known gaps / intentionally out of scope (for now)

- No flow for leaving an **active** (already-started) group — leaving is only
  supported pre-activation. Defaulting is currently the only way to exit an
  active group's rotation.
- No redistribution mechanism for withheld payouts (defaulted recipient) —
  currently a manual/future admin action.
- No push notifications beyond in-app/socket — `Notification` rows are
  created and pushed over the socket, but there's no dedicated
  list/mark-as-read REST endpoint yet.

---

## Scripts

```bash
npm run start:dev      # dev server, watch mode
npm run build           # compile to dist/
npm run start:prod      # run compiled build
npm run lint             # eslint
npm run test              # unit tests
npx prisma studio       # browse the database
npx prisma migrate dev  # create + apply a migration
```
