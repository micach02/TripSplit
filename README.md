# TripSplit

**Travel together. Track together. Split smarter.**

TripSplit is a group-travel budget and expense tracker: create a trip, set a budget, invite friends, log expenses, split them, and see who owes whom.

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
- GitHub Pages has no single-page-app fallback, so the workflow copies `index.html` to `404.html`. Deep links such as `/<repo>/invite/<token>` then load the app, which routes them.

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
- **Invite links.** Every invitation has an unguessable `token`; `/invite/<token>` shows a preview and joins via `tripsplit.accept_invitation_link`. The link is the credential (whoever opens it while signed in can join), it works once, and it expires with the invitation (7 days). No email service is needed — owners copy or share the link. Signed-out visitors are sent to log in or register and then returned to the link.
- **"Involving" filter.** `expenses.participant_ids` (payer + everyone in the split) is kept up to date by triggers, so "expenses involving Ben" is one indexed `@>` query.
- **Errors**: triggers raise stable message keys (e.g. `split_total_mismatch`) that `lib/errors.ts` maps to friendly copy. Raw database errors are never shown.
