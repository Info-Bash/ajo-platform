# Ajo — User Flows

This documents how a person actually moves through the app, end to end. Pair
this with `ajo-server/README.md` (architecture) and `ajo-client/README.md`
(frontend structure) for the technical side.

---

## 0. User Flow Video recording

link: https://youtu.be/TKKkUZBGxls?si=bgwSOkAcPeZR-6TM

---

## 1. Onboarding

1. **Register** — email + password, or Google.
2. **Verify email** — link sent to inbox; account is unusable for money
   movement until verified.
3. **Complete profile** — full name, etc.
4. **Login** — issued a JWT.
5. Behind the scenes: a **wallet** (virtual account) is created automatically
   for every new user — nothing to set up manually.

```
Register → Verify email → Complete profile → Login → Wallet ready
```

---

## 2. Wallet

Independent of Ajo groups — a normal digital wallet:

- **Fund** — top up via Nomba.
- **Transfer** — send to another Ajo user by account number.
- **Withdraw** — cash out to a bank account (requires a transaction PIN,
  set once under wallet settings).

Every movement is double-entry: a debit and a credit row sharing a
`journalId`, so the transaction history is always reconcilable.

---

## 3. Creating an Ajo circle

From **Ajo Groups → Create**, the creator (who becomes the group's first
member and admin) sets everything up front:

| Setting | What it controls |
|---|---|
| Name / description | Display info |
| Contribution per member | How much each person pays per round |
| Number of members | = number of rounds. Fixed group size. |
| Frequency | Daily / Weekly / Monthly (or `Testing` — 3-minute rounds, dev builds only) |
| Visibility | **Private** (invite-link only) or **Public** (discoverable, join-by-request) |
| Activation mode | **Auto-start when full** or **Manual start by admin** |

On create: the group, its dedicated group wallet (holds pooled contributions
until payout), and its group chat are all created together. A system message
("🎉 \<name\> was created") posts to the chat immediately.

---

## 4. Growing the circle — Private groups

Only joinable via **invite link**:

1. Admin opens the group → copies the invite link (`/groups/join?code=...`).
2. Shares it however they like (WhatsApp, SMS, etc.).
3. Anyone with the link joins **instantly** — no approval step, since holding
   the link *is* the vetting.
4. Admin can also **directly invite a specific person** by their wallet
   account number — they get a notification with the invite code.

```
Admin copies link → shares it → recipient opens /groups/join?code=XXXX → joins instantly
```

---

## 5. Growing the circle — Public groups

Discoverable while still gathering members:

1. Group appears on the **Discover** page (public + still has open slots).
2. Interested user taps **Request to join**, optionally with a short message.
3. Admin sees the request under the group's admin panel and **approves or
   declines** it.
4. Approved → instantly becomes a member. Declined → notified, can request
   again later.

```
User finds group on Discover → Request to join (+optional note)
   → Admin reviews → Approve (joins) or Decline (notified)
```

---

## 6. What happens when someone joins (either path)

Every new member, regardless of how they joined:

- Gets assigned the **next payout slot** in line (first-come-first-served —
  this is locked in immediately and never changes).
- Is **automatically friended** with every existing member of the group (and
  vice versa) — no friend request needed.
- Triggers a **"👋 \<name\> joined the group"** system message in the group chat.
- If this fills the last slot on an **auto-start** group, the group
  **activates immediately** (see next section).

---

## 7. Starting the rotation (activation)

Depends on the mode chosen at creation:

- **Auto-start when full** — activates the instant the last member joins.
  No admin action needed.
- **Manual start by admin** — the admin can start once there are at least 2
  members, whenever they're ready (doesn't have to wait for the group to be
  full). Starting early with fewer members than the original target shrinks
  the rotation to the actual member count — everyone still pays the rate
  they signed up for, the pot is just smaller.

On activation:

- Membership **locks** — no new members, no leaving via the normal flow.
- Payout order is final.
- The **full round schedule** is generated for the whole rotation.
- **Round 1 begins** — a "🚀 Contribution period has started!" message posts
  to the group chat, and everyone gets a notification.
- Group settings (amount, frequency, payout method, etc.) become read-only.

---

## 8. The contribution cycle (repeats every round)

For each round, every active member owes their contribution:

1. **Pay** — from the group's Schedule tab, each member pays their share
   (debited from their wallet, credited to the group wallet).
2. **Reminder** — about two-thirds through the round's time window, an
   automatic "⏰ contribution due soon" message posts to the group chat.
3. **Late** — miss the due date → marked `LATE`. Notified privately (not
   broadcast to the group, to avoid public shaming).
4. **Defaulted** — miss the grace period on top of that → marked
   `DEFAULTED`, and the member becomes inactive for the *remaining* rounds
   (they're skipped in future contribution requirements).
5. **Round finalizes** the instant every member's contribution for that
   round is resolved (paid or defaulted) — this can happen early if
   everyone pays ahead of schedule:
   - A "✅ Round complete" message posts.
   - The **payout releases** to that round's recipient — the *actual amount
     collected*, not the full theoretical pot (so a default shrinks the
     payout rather than the group covering the gap).
   - If the recipient themselves has since defaulted or exited, the payout
     is **withheld** instead (flagged for manual review) rather than paid out.
   - The **next round opens automatically** with a "🔔 Round N has begun!"
     message — no admin action needed.
6. Once the **last round** finalizes, the group is marked **Completed**.

```
Round opens → members pay → (late? default?) → all resolved
   → payout released to this round's recipient → next round opens
   ... repeats until every member has been paid ...
→ group marked Completed
```

---

## 9. Group chat

Every group has its own chat from the moment it's created:

- Members send messages in real time.
- The system automatically posts updates for key events: member
  joined/left/removed, group activated, contribution reminders, round
  completions, and payouts released — so nobody has to manually announce
  these things.

---

## 10. Friends & direct messages

- **Friends are automatic** — a byproduct of sharing a group, not a
  separate request/accept flow.
- The **Friends** page lists everyone you've connected with this way.
- **Direct messages** are 1:1 only, and — by design — you can only *start* a
  new conversation with someone you're already friends with (i.e. share a
  group with). This leans into the app's model: the trust comes from the
  group, not from messaging a stranger first.
- Messages arrive in real time; opening a thread marks the other person's
  messages as read.

---

## 11. Dashboard

The home screen aggregates everything at a glance:

- Wallet balance.
- Active / completed / exited group counts.
- The single **nearest upcoming contribution** due across all your groups.
- The single **nearest upcoming payout** owed to you across all your groups.
- Recent wallet transactions.

---

## Notes for testers

- Use the **Testing** frequency (3-minute rounds, 1-minute grace period)
  when creating a group in a dev/staging build to run a full round →
  payout → next round cycle in a few minutes instead of days. It's rejected
  automatically in production.
- The contribution engine is cron-driven and ticks every minute — expect up
  to a ~1 minute delay between a due date passing and a status actually
  flipping to `LATE`/`DEFAULTED`, or a round finalizing.
