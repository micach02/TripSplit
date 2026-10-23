# TripSplit

**Travel together. Track together. Split smarter.**

TripSplit tracks shared and personal spending. Make a **monthly budget** for everyday costs (groceries, food, bills) on your own or with your household, or a **trip** with dates and one total budget. Add the people you share costs with by name (no account needed), log expenses, split them, and see who owes whom. Anyone who wants to see the trip themselves can be invited to the app.

**My spending** brings your share of everything together month by month: by category, by day, by budget, by how you paid, against last month and against your income. Rent and subscriptions can repeat on their own; a budget can carry what's left into the next month; you get a warning before a budget runs out. It installs as an app, keeps working offline, reads totals off receipt photos, exports CSV, and has a dark mode.

React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · React Router 7 · Supabase (Auth, Postgres, RLS, Storage) · Lucide · date-fns · Vitest

---

## Getting started (local Supabase)

Prerequisites: **Node 22+** and **Docker Desktop** (the local Supabase stack pulls several GB of images — make sure Docker's disk image lives on a drive with room to spare: *Docker Desktop → Settings → Resources → Advanced → Disk image location*).

```bash
npm install
npm run db:start          # starts Supabase in Docker, applies migrations + seed
cp .env.example .env      # paste the API URL and anon/publishable key that db:start printed
npm run dev               # http://localhost:5173
```

Local services: Studio http://127.0.0.1:54323 · Mailpit (all auth emails) http://127.0.0.1:54324

### Seed accounts

All seeded accounts use the password **`tripsplit123`**.

| Email | Who |
| --- | --- |
| `michael@tripsplit.dev` | Owner of **Singapore Adventure** (active, ₱50,000 budget, ~₱38k spent) |
| `john@tripsplit.dev`, `sarah@tripsplit.dev` | Singapore members |
| `anna@tripsplit.dev` | Singapore member; owner of **Tokyo Cherry Blossoms** (JPY) |
| `paolo@tripsplit.dev` | Has a pending invitation to Singapore |

Michael, John and Paolo must never see the Tokyo trip — a quick manual RLS check.

## Using a hosted Supabase project (no Docker needed)

TripSplit lives entirely in its own schemas (`tripsplit`, `tripsplit_private`), its own storage buckets (`tripsplit-avatars`, `tripsplit-trip-covers`) and adds **no triggers to `auth.users`**, so it can share a project with another app without touching that app's tables.

1. **Link the CLI** (in your own terminal — it opens a browser):
   `npx supabase login`, then `npx supabase link --project-ref <ref>` (the database password prompt can be left blank).
2. **Apply the migrations**: `npm run db:migrate:remote`. It runs each pending file in `supabase/migrations` in its own transaction through the Management API and records it in `tripsplit_private.schema_migrations` — the project's own CLI migration history is never touched. (`npm run db:status:remote` shows what's applied.)
3. **Expose the schema**: Dashboard → Project Settings → Data API → *Exposed schemas* → add `tripsplit` (keep the existing entries).
4. **Allow the redirect**: Authentication → URL Configuration → *Redirect URLs* → add `http://localhost:5173/**` (and your deployed URL later). Leave the Site URL alone if another app uses the project.
5. Put the project URL and **anon / publishable** key in `.env`. Never use the service-role / secret key in the frontend — the app refuses to start if it detects one.
6. Check it: `npm run db:test:remote` (RLS tests, fully rolled back) and `npm run db:types:remote`.

The seed is **local-only** — it creates accounts with a published password. On a hosted project, sign up through the app instead.

### Shared projects — things not to do

- **Don't run `supabase config push`**: it would overwrite the other app's Auth settings (Site URL, email templates, providers) with `supabase/config.toml`.
- **Don't use `supabase db push`** against a shared project — it writes to the other app's migration history. Use `npm run db:migrate:remote`.
- Auth is shared: anyone with an account in the other app can log into TripSplit with the same credentials (TripSplit creates their profile on first visit), and vice versa.
- Deleting an auth user who owns TripSplit trips or has recorded expenses is blocked by foreign keys — deliberately, so shared trip history isn't silently destroyed.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` lints, tests, builds and publishes the app on every push to `main` (or on demand from the Actions tab). It's served from `https://<user>.github.io/<repo>/`.

One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → New repository secret**, twice:
   - `VITE_SUPABASE_URL`: the bare project URL, `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: the anon / publishable key. It ends up in the public site's JavaScript, which is expected; RLS protects the data. Never the service-role key.
3. **Supabase → Authentication → URL Configuration → Redirect URLs**: add `https://<user>.github.io/<repo>/**` so sign-up confirmation and password-reset emails can return to the site.

How it works:

- The build sets `BASE_PATH=/<repo>/`. Vite prefixes assets with it, React Router uses it as the basename, and links that leave the app (invite links, auth emails) include it. Locally nothing changes; the app still runs at `/`.
- GitHub Pages has no single-page-app fallback, so the workflow copies `index.html` to `404.html`. Deep links such as `/<repo>/invite/<token>` then load the app, which routes them — but with a 404 status, which chat apps won't build a preview card for. That's why shared invite links use the root, `/<repo>/?invite=<token>`, which the app forwards to the invite.
- The workflow sets `SITE_URL` so the link-preview tags in `index.html` (`og:image`, `og:url`, canonical) get absolute addresses; `vite.config.ts` fills in `%SITE_URL%`. The preview image is `public/og-image.png` (1200×630).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project build check |
| `npm test` | Unit tests (Vitest) |
| `npm run db:start` / `db:stop` | Start / stop local Supabase |
| `npm run db:reset` | Re-create the local DB from migrations + seed |
| `npm run db:test` | RLS & integrity tests (pgTAP, `supabase/tests`) |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local DB |
| `npm run db:migrate:remote` | Apply pending migrations to the linked hosted project (no Docker, no DB password) |
| `npm run db:status:remote` | Show which migrations are applied on the linked project |
| `npm run db:test:remote` | All pgTAP suites against the linked project (no Docker; everything rolls back) |
| `npm run db:types:remote` | Regenerate types from the linked hosted project |
| `npm run db:advisors:remote` | Supabase security & performance advisors for the linked project |

## Project structure

```text
src/
  components/   ui/ (primitives) · forms/ · layout/ · dashboard/ · trips/ · expenses/ · members/ · profile/
  contexts/     Auth + toast providers
  hooks/        useAuth, useAsync, useToast, …
  lib/          Supabase client, env checks, currencies, error mapping
  pages/        One lazily-loaded module per route
  routes/       Router, route guards, paths
  services/     All Supabase access (pages never call the client directly)
  types/        Generated database types + app aliases
  utils/        calculations/ (money, budgets — pure & unit-tested), formatting, validation
supabase/
  migrations/   Schema, RLS, storage
  tests/        pgTAP tests
  seed.sql      Development data
```

## Conventions worth knowing

- **Money** is `numeric(14,2)` in Postgres and **integer minor units** in the app (`utils/calculations/money.ts`). Splits use largest-remainder allocation, so ₱1,000 ÷ 3 = ₱333.33 + ₱333.33 + ₱333.34. Conversion rounding matches Postgres exactly. Decimal strings — never floats — are written back to the DB.
- **Integrity lives in the database.** Triggers compute `converted_amount`, force settlements into the trip currency, check that payers/participants are members, lock the trip currency once money is recorded, and (at commit) require every expense's splits to add up to its total.
- **Own schema.** All tables live in `tripsplit` (the client is created with `db: { schema: 'tripsplit' }`); helpers and trigger functions live in `tripsplit_private`, which is never exposed. Profiles are created by the `tripsplit.ensure_profile()` RPC on sign-in rather than by a trigger on `auth.users`.
- **RLS on every table.** A trip and everything in it is visible only to its members. Owners administer the trip; members add expenses and settlements and can edit expenses they created or paid for. Clients can't insert memberships directly, and identity columns (`owner_id`, `trip_id`, `created_by`, profile `email`) aren't updatable through the API.
- **Currencies.** Each trip has one currency; expenses can be in any supported currency with an exchange rate. Rates are filled in automatically from European Central Bank reference rates via the free [Frankfurter API](https://frankfurter.dev) (only currency codes are sent; the last typed rate is the offline fallback) — see `services/exchangeRates.ts`. The "View in" switcher converts a trip's figures for display only; stored amounts change only when the owner uses **Change currency** (the `tripsplit.change_trip_currency` RPC re-bases every expense and re-spreads shares so they still add up exactly).
- **Balances.** net = paid − share + settlements paid − settlements received (`utils/calculations/balanceCalculator.ts`); `debtSimplifier.ts` turns balances into the fewest practical payments (exact matches first, then largest-to-largest). The `tripsplit.trip_member_balances` view computes the same numbers in SQL for the dashboard.
- **Receipts** live in the private `tripsplit-receipts` bucket at `<trip id>/<expense id>/receipt-<time>.<ext>` (JPG/PNG/WEBP, 5 MB cap enforced by the bucket). Photos are shrunk in the browser to ≤2000 px JPEG before upload (`utils/image.ts`). Trip members view them through 1-hour signed URLs; only people who can edit the expense can add, replace or remove one. A trigger rejects a `receipt_url` that points into another expense's folder. The expense is saved first, then the receipt; if the upload fails the expense is kept and the user is told.
- **People added by name.** Friends don't need an account. `tripsplit.add_trip_person` creates a profile that belongs to one trip (`profiles.guest_trip_id`, no email or login) and makes it a member, so paying, splits, balances, settlements and recurring expenses work for them like for anyone else, and the existing "must be a member" checks still apply. Any member can add people; the owner or whoever added someone can rename (`rename_trip_person`) or remove (`remove_trip_person`) them, but not once they have expenses, settlements or a recurring expense. Names are unique per trip, ignoring case, and deleting a trip deletes its named people. Because of this, `profiles.id` no longer references `auth.users`: accounts still get their profile only through `ensure_profile()`. Inviting someone on the list is optional: an invitation with `person_id` lets whoever accepts take that person's place, and `tripsplit_private.join_trip` moves everything recorded for them (what they paid, their shares, settlements, recurring expenses) to the new account. Chips, expense rows and chart labels use first names, or the full name when two people share one (`shortName`).
- **Invite links.** Every invitation has an unguessable `token`; `/invite/<token>` shows a preview and joins via `tripsplit.accept_invitation_link`. The link is the credential (whoever opens it while signed in can join), it works once, and it expires with the invitation (7 days). No email service is needed — owners copy or share the link. Signed-out visitors are sent to log in or register and then returned to the link. If email confirmation takes them somewhere else, the invite is remembered on that device for that email (`lib/pendingInvite.ts`) and reopened the next time they're signed in.
- **Invitation lifecycle.** Status changes only through functions: accept / decline (invitee), `tripsplit.renew_invitation` (owner: fresh 7-day window and a new link; the old link stops working), delete = cancel. Clients can't `UPDATE` invitation rows. "Expired" is derived from `expires_at` (no scheduler on a shared project). Joining a trip by any route closes the person's other pending invitations to it. Owners see pending invites with their expiry and a "Didn't join" list (expired / declined) with **Invite again**; invitees get a badge on the bell.
- **Search.** `/search` (header button on phones, sidebar on desktop, `/` or Ctrl/⌘ K anywhere) finds budgets and trips by name or destination (from the list already on the device, so it works offline) and expenses across all of them through `tripsplit.search_expenses`. That function runs with the caller's rights, so row-level security decides what's visible. Every word must match the description, notes, category, budget or trip, or who paid or shared it; a number also matches an amount exactly ("4,800"). Results highlight the words, a result opens the expense on its Expenses tab (`?expense=<id>`), the query stays in the URL so Back returns to it, and searches you act on are remembered on the device.
- **"Involving" filter.** `expenses.participant_ids` (payer + everyone in the split) is kept up to date by triggers, so "expenses involving Ben" is one indexed `@>` query.
- **Accessibility.** Pages are checked with axe-core against WCAG 2.2 AA at phone and desktop sizes, in light and dark mode. Text uses at least the `-700` shade for green/orange and `slate-500` for grey; icon-only buttons carry an `aria-label`. Small text actions use the `tap-target` utility (`src/index.css`) for a ~44px hit area without shifting layout. After each navigation `RouteAnnouncer` reads the new page title to screen readers and moves focus to `<main>` (unless the page already focused a field). Animations stop under `prefers-reduced-motion`.
- **Loading, offline, errors.** Loading states are skeletons shaped like the content (`components/ui/Skeleton.tsx`), so nothing jumps when data arrives. An offline banner appears whenever the connection drops; a page that couldn't be downloaded while offline says so instead of "something went wrong".
- **Offline and install.** `public/sw.js` (production only) serves the saved app shell when there's no connection and keeps built files and fonts it has fetched; Supabase calls always go to the network. Lists last seen online are kept in `localStorage` (`lib/offlineCache.ts`). An expense saved offline goes into an IndexedDB outbox (`lib/outbox.ts`) with a `client_id`, and `syncService` sends it when the connection returns — `save_expense` returns the existing row for a `client_id` it has seen, so a retry never makes a duplicate. `public/manifest.webmanifest` makes the app installable; Settings has an Install button (Chrome, Edge, Android) or Add to Home Screen steps (iPhone).
- **Performance.** Every page is its own chunk; once the app has been idle for a few seconds, `routes/prefetch.ts` fetches the most-used pages (not on data-saver or 2G). The font is one variable file. The trip banner image loads eagerly with high priority; other images are lazy. Invitations are loaded once for the badge, dashboard banner and Notifications page.
- **Budgets and trips.** Both are rows in `tripsplit.trips`, told apart by `kind` (`trip` | `budget`, fixed at creation). A budget has no end date or destination; its `budget` is the amount **per calendar month**, and category budgets are monthly limits. Budgets get everyday default categories, trips get travel ones. `tripsplit.trip_month_totals` gives spending per month. Budget pages carry the month being viewed in the URL (`?month=2026-09`); Overview, Expenses and Analytics follow it, while Balances (with the list of payments recorded) are all-time so people can settle up whenever. With only one member, the Balances tab and the expense form's payer/split fields are hidden.
- **My spending.** `tripsplit.my_expense_shares` (a security-invoker view) lists your own share of every expense you're part of; `utils/calculations/mySpending.ts` turns a month of it into totals by category, day, budget and payment method, the change against last month, a month-end forecast and, with `tripsplit.incomes` (rows only you can see), what you saved. Amounts in other currencies are converted for display. Budget warnings (90% used, and over) are worked out on the client (`utils/calculations/insights.ts`) and shown in Notifications; dismissing one is remembered on that device.
- **Recurring expenses.** `tripsplit.recurring_expenses` holds a template (amount, day of month, who shares it). *Automatic* ones are posted by `tripsplit.post_due_recurring()`, which the app calls on start (no scheduler on a shared project); each month is posted at most once (a unique index on `recurring_id, recurring_period`). *Reminders* show on the budget's Overview with **Add it** (a pre-filled form) and **Skip**.
- **Rollover.** A budget with `rollover` on carries what's left (or the overspend) from every earlier month into the current one (`availableForMonth`); the header says how much came from earlier months.
- **Receipt scanning** runs Tesseract in the browser (`lib/receiptOcr.ts`, loaded only when used); the photo never leaves the device for scanning. `utils/receiptParser.ts` picks out the total, date and shop, and the person confirms them with **Use these**.
- **Dark mode.** Light, dark or system, saved per device (`lib/theme.ts`; an inline script in `index.html` applies it before the first paint). Instead of `dark:` classes on every component, `src/index.css` remaps the palette under `[data-theme='dark']`: neutrals invert, tints become dark washes, text shades become light. Card backgrounds use `bg-surface` (not `bg-white`), and fills that carry text use the fixed `brand-*` / `sunset-*` / `danger-*` colours. Charts take their own validated dark palette from `useChartColors()`.
- **Look and feel ("playful travel").** A sea-teal `primary` scale for actions, links and focus, and a `coral` accent for the + button, highlights and warm decoration — never for money states, which stay emerald (receive) and red (owe). Both scales are defined in `src/index.css` with dark-mode steps, and every text pair was checked at 4.5:1 or better. Shapes are rounder (`--radius-*`), cards float on `shadow-card`, buttons are pills (`accent` is the warm one for "Add expense"), categories and empty states use emoji bubbles, and each budget or trip gets its own travel gradient and emoji when it has no photo (`utils/coverStyle.ts`). Brand panels are deep teal with a small coral "sun" — solid, not translucent, since translucent coral over teal turns brown.
- **CSV export.** My spending and every Expenses tab export what's on screen (the current month or filters) with `utils/csv.ts`, which defuses spreadsheet formulas in text cells.
- **First visit and first run.** Signed-out visitors to `/` get the landing page (`pages/LandingPage.tsx`, via `routes/HomeRoute.tsx`); signed-in people go straight to the dashboard. `/privacy` and `/terms` are open to everyone, and sign-up links to them. A new account has `profiles.onboarded_at` = null, so `ProtectedRoute` sends it to `/welcome` once (name and currency, then "what do you want to track first?", which opens the create form pre-filled); joining through an invite skips it. The dashboard then shows a "Getting started" checklist until it's done or hidden.
- **Trip pages.** Five tabs at most so they fit a phone: Overview, Expenses, People, Balances (suggested payments, everyone's balance, and the payments recorded) and Analytics. Settings is the gear in the trip header; old `/settlements` links land on `/balances#payments`.
- **Errors**: triggers raise stable message keys (e.g. `split_total_mismatch`) that `lib/errors.ts` maps to friendly copy. Raw database errors are never shown.
