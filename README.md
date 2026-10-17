# FlowPilot

FlowPilot is an all-in-one business operations SaaS for freelancers, small businesses and small teams: client CRM, projects, Kanban tasks, invoicing, analytics, team management, notifications, an audit log and subscription billing in one workspace.

- **Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Supabase (Postgres, Auth, RLS, Storage) · Stripe · Recharts · Lucide · React Hook Form + Zod · dnd-kit · Playwright
- **Runs without any accounts:** with no Supabase keys, the app starts in **demo mode** (built-in auth plus a local JSON store seeded with the "Vertex Creative" workspace), so you can try every feature immediately.

---

## Quick start (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **View Demo**, or log in as `alex@vertex-demo.com` / `demo1234`. You can also sign up for a fresh workspace. Demo data is stored in `.data/`; `npm run demo:reset` restores the seed.

The other seeded users (same password): `sarah@vertex-demo.com` (Admin), `marcus@vertex-demo.com` and `emma@vertex-demo.com` (Members).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | Generates route types and runs `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run db:verify` | Applies the migration and seed to an embedded Postgres (PGlite) and runs 26 RLS / tenant-isolation checks. No Docker needed. |
| `npm run db:seed:generate` | Regenerates `supabase/seed.sql` from `lib/demo/seed.ts` |
| `npm run test:e2e` | Playwright end-to-end tests (desktop + 375px mobile) against a production build in demo mode. Run `npm run build` first. Set `PW_CHANNEL=msedge` or `chrome` to use an installed browser, otherwise run `npx playwright install chromium` once. |
| `npm run check` | typecheck + lint + db:verify + build |

---

## Features

| Area | Highlights |
| --- | --- |
| Landing page | Hero with dashboard preview, social proof, features, pricing (Starter / Pro / Business), FAQ, footer, privacy/terms/contact pages |
| Auth | Sign up (name, email, password, workspace), login, logout, forgot/reset password, email verification (Supabase), invite links, session persistence, protected routes |
| Onboarding | 4 steps with progress: business info → main goal → invite team (skippable) → first client or project |
| App shell | Sidebar (collapses to a drawer on mobile), workspace switcher + create workspace, account menu, breadcrumbs, Ctrl/Cmd+K command palette, notification bell with unread badge, help menu |
| Overview | 5 KPIs with % change vs. last month, 12-month revenue, project health donut (Active / At Risk / Completed / On Hold), client growth, activity feed, upcoming deadlines, outstanding invoices |
| Clients | Search, status filter, sortable columns, pagination, create/edit/archive/delete (clients with invoices must be archived), detail page with contact and company info, notes, tags, projects, invoices, lifetime revenue, files, activity |
| Projects | Grid and list views, filters, create/edit/delete, status changes, members, detail tabs (Overview, Tasks, Files, Activity, Financials with budget, billed, outstanding, expenses and profit) |
| Tasks | Kanban with drag-and-drop (mouse, touch and keyboard), table view with one-click complete, filters (project, assignee, priority, due, label), search, detail drawer with comments and activity; project progress updates automatically |
| Invoices | Builder with multiple line items and live subtotal/tax/total, sequential numbers, draft → sent → paid, overdue detection, duplicate, cancel, delete drafts, printable page and **PDF download** |
| Analytics | 7d / 30d / 90d / 1y ranges; revenue, profit, new clients, retention, average project and invoice value, outstanding; revenue trend, revenue by client, project profitability, paid vs outstanding, client acquisition, workload by member (advanced charts gated to Pro/Business) |
| Team | Owner / Admin / Member / Viewer roles, invite by link, revoke invites, change role, remove member, member activity, seat limits per plan |
| Notifications | Invoice paid, task assigned/overdue, deadlines, member invited, client added; mark read/unread, mark all read, delete, unread badge, per-category preferences |
| Activity log | Who did what to which record, filters, pagination, CSV export (Business plan, owners/admins) |
| Settings | Profile (name, avatar, email), workspace (name, logo, industry, size, leave/delete), billing (plans, upgrade/downgrade, payment method, history), notifications, security (change password, sessions, sign out others, delete account), appearance (light/dark/system) |
| Billing | Stripe Checkout, Billing Portal and webhook handlers; 14-day Pro trial for new workspaces; plan limits enforced server-side (users, active projects, clients) |
| Automation | Daily Vercel Cron job (`/api/cron/reminders`) for overdue-task and deadline notifications |

---

## Architecture

```
app/                     Routes (App Router)
  (marketing)/           Landing, privacy, terms, contact
  (auth)/                Login, signup, forgot/reset password, verify email
  auth/confirm/          Supabase email-link handler
  invite/[token]/        Accept a workspace invitation
  onboarding/            4-step setup
  dashboard/             Authenticated app (each route has loading + error states)
  api/                   Stripe, files, PDFs, CSV export, cron, health
components/              UI by feature (app shell, clients, projects, tasks, invoices, …) + ui/ (shadcn)
hooks/                   useAction (server action + toasts), useQueryState (URL filters)
lib/
  backend/               Backend port: Supabase adapter and demo adapter (auth, data, storage)
  db/                    Minimal query interface (Db) with Supabase and JSON-file implementations
  services/              Business logic: clients, projects, tasks, invoices, analytics, team, billing…
  actions/               Server Actions ("use server"): auth, records, account, workspace
  server/                Request context (session + active workspace), action runner, errors
  validation/            Zod schemas shared by forms and server
  demo/seed.ts           Deterministic seed data (feeds demo mode and supabase/seed.sql)
supabase/
  migrations/            Schema, RLS policies, triggers, RPCs, storage buckets/policies
  seed.sql               Generated demo data
  config.toml            Supabase CLI config
scripts/                 Seed generator, embedded-Postgres verification, e2e server
tests/e2e/               Playwright specs
types/database.ts        Row types for every table
proxy.ts                 Optimistic route protection + Supabase session refresh
```

**Request flow.** Pages and Server Actions call `getWorkspaceContext()`, which validates the session server-side (`supabase.auth.getUser()` in Supabase mode), loads the user's memberships and picks the active workspace from a cookie *only if the user is a member of it*. Every service function takes that context and scopes every query by `workspace_id`. In Supabase mode those queries run as the signed-in user, so Postgres RLS enforces the same boundary a second time.

**Mutations** go through `runAction()` (`lib/server/action.ts`): authenticate → check role permission (`lib/permissions.ts`) → validate with Zod → run the service → revalidate → return a typed `{ ok, data | error, fieldErrors }`. Errors are mapped to user-safe messages; internals are logged on the server only.

**Two backends, one codebase.** `lib/backend` exposes auth, data (`Db`), storage and a few privileged RPCs. The Supabase adapter maps to PostgREST/RLS; the demo adapter mirrors the same constraints (unique keys, cascades) in a JSON file. The services, UI and tests are identical in both modes.

## Database

Tables (UUID keys, `created_at`/`updated_at` with triggers, indexes on every foreign key and common filter):
`profiles`, `workspaces`, `workspace_members`, `workspace_invitations`, `clients`, `projects`, `project_members`, `tasks`, `task_comments`, `invoices`, `invoice_items`, `expenses`, `files`, `notifications`, `activity_logs`, `subscriptions`, `billing_history`.

Security model:
- **RLS on every table.** Members read workspace data; members+ write; admins delete clients/projects; only drafts can be deleted; notifications are private to their recipient; the activity log is append-only and only as yourself; subscriptions are read-only to users (written by the Stripe webhook with the service role).
- **Composite foreign keys** (`(id, workspace_id)`) make it impossible to attach a task, invoice, comment or file to a parent in another workspace, and assignees/owners must be members of the same workspace.
- **Role guard trigger:** only owners can grant the owner role, and the last owner can't be demoted or removed.
- **Security-definer RPCs** for the few cross-tenant operations: `create_workspace`, `accept_invitation` (email must match), `get_invitation`.
- **Signup trigger** creates the profile, the first workspace, the owner membership and a 14-day Pro trial from the signup metadata.
- **Storage:** private `workspace-files` bucket scoped by `<workspace_id>/…`; public `public-assets` bucket for avatars and logos, writable only by the owner/admins.

`npm run db:verify` proves these rules in an embedded Postgres: an outsider can't read, insert or update another workspace's rows, can't reference another workspace's records, members can't escalate their role, and invitations only work for the invited email.

---

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Production | Public URL; used in email, invite and Stripe redirect links |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase mode | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase mode | Anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, cron, account deletion | **Server only** |
| `STRIPE_SECRET_KEY` | Paid plans | **Server only** |
| `STRIPE_WEBHOOK_SECRET` | Paid plans | From the webhook endpoint |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Reserved for client-side Stripe.js; Checkout and the Portal are server-redirect flows |
| `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | Paid plans | Monthly recurring Price IDs ($19 and $49) |
| `CRON_SECRET` | Reminder job | Vercel sends it as a Bearer token |
| `FLOWPILOT_DEMO_MODE`, `DEMO_SESSION_SECRET`, `DEMO_DATA_DIR`, `DEMO_ACCOUNT_EMAIL`, `DEMO_ACCOUNT_PASSWORD` | Optional | See `.env.example` |

Without Supabase variables the app runs in demo mode. Without Stripe variables, billing shows "not configured" in Supabase mode (and is simulated in demo mode); everything else works.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (or run locally with the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker: `npx supabase start`).
2. Apply the schema:
   - CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`
   - or paste `supabase/migrations/20261017000000_initial_schema.sql` into the SQL editor and run it.
3. Optional demo data: run `supabase/seed.sql` in the SQL editor (local: `npx supabase db reset` applies it automatically). It creates the four Vertex Creative users with password `demo1234`. Don't run it on a production project.
4. **Authentication → URL Configuration:** set Site URL to your app URL and add `https://<your-domain>/auth/confirm` (and `http://localhost:3000/auth/confirm` for development) to Redirect URLs.
5. **Authentication → Providers → Email:** keep "Confirm email" on for production. For reliable delivery configure custom SMTP (Authentication → Emails → SMTP).
6. Copy the URL, anon key and service-role key into your environment.

## Stripe setup

1. In the Stripe dashboard create a product "FlowPilot" with two monthly prices: **Pro $19** and **Business $49**. Copy their Price IDs into `STRIPE_PRICE_PRO` and `STRIPE_PRICE_BUSINESS`.
2. Copy the secret key into `STRIPE_SECRET_KEY` (use test keys first).
3. Add a webhook endpoint `https://<your-domain>/api/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Enable the **Customer portal** (Settings → Billing → Customer portal) and allow plan switching between the two prices and cancellation.

Endpoints: `POST /api/stripe/checkout` `{ plan: "pro" | "business" }` → `{ url }`, `POST /api/stripe/portal` → `{ url }`, `POST /api/stripe/webhook`. Settings → Billing uses the same server code via a Server Action.

## Deploy to Vercel

1. Push this repository to GitHub, GitLab or Bitbucket.
2. In Vercel: **Add New → Project**, import the repo. The framework preset (Next.js), build command (`next build`) and output are detected automatically. `.npmrc` sets `legacy-peer-deps` so installs match local.
3. Add the environment variables above (Production and Preview). Set `NEXT_PUBLIC_APP_URL` to the production domain.
4. Deploy. Then:
   - add `https://<domain>/auth/confirm` to Supabase Redirect URLs and set the Site URL;
   - point the Stripe webhook at `https://<domain>/api/stripe/webhook`;
   - set `CRON_SECRET` so the daily reminder job in `vercel.json` is authorized.
5. Smoke-test: `https://<domain>/api/health` should report `"mode": "supabase"`; sign up, confirm the email, finish onboarding and create a client.

A deployment without Supabase variables runs in demo mode with data in `/tmp`, which resets whenever the serverless instance recycles. That's fine for a preview, not for real data.

---

## Testing

- **End-to-end (Playwright):** 22 tests covering sign up + onboarding + logout/login, signup validation, wrong password, password reset, the demo button, unauthorized redirects (with return-to), anonymous API rejection, cross-workspace access returning 404, navigation to every main page, creating a client (plus validation errors), creating a project, creating and completing a task, Kanban drag-and-drop, creating an invoice with two line items ($2,700 + 9% tax = $2,943), sending/paying it and downloading the PDF, Ctrl+K search, notifications, team invites, and a 375px mobile pass (drawer navigation, no horizontal overflow).
- **Database:** `npm run db:verify` (migration, seed, signup trigger, RLS, composite FKs, role guards, invitations, storage policies).
- **Static:** `npm run typecheck`, `npm run lint`, `npm run build`.

## Known limitations

- Supabase and Stripe integrations are built and type-checked, and the SQL is verified in an embedded Postgres, but they haven't been exercised against live Supabase/Stripe projects in this repository's test runs (no credentials were available). Demo mode is fully tested end to end.
- Emails (verification, password reset, invites) are sent by Supabase Auth. Team invitations are shared as links; there's no transactional email provider wired in for invites or the weekly report preference.
- Supabase doesn't expose a user's other sessions to clients, so Settings → Security lists the current device and offers "sign out other sessions".
- Analytics aggregate in the application server per request, which is fine for small-team data volumes; very large workspaces would benefit from SQL views or materialized aggregates.
- Demo mode stores data in a JSON file and is meant for local development, previews and tests, not production.
