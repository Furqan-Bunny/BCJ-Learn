# BCJ Learn — Setup

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine at this scale)
- (Optional) Resend account for transactional email
- (Optional) Anthropic API key for AI question authoring

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the Supabase values from your project dashboard:

- **Project Settings → API → Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Project Settings → API → anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Project Settings → API → service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never commit)

## 3. Apply the database migration

The initial schema lives at `supabase/migrations/0001_initial_schema.sql`. You can apply it two ways:

**Option A — Supabase Studio (quickest)**

1. Open your project at app.supabase.com.
2. SQL Editor → New Query.
3. Paste the contents of `supabase/migrations/0001_initial_schema.sql`.
4. Run.

**Option B — Supabase CLI (recommended for ongoing work)**

```bash
npm install -D supabase
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

After the migration runs you should see 16 tables in the Table Editor, all with RLS enabled (a lock icon next to each), and 3 storage buckets (`module-content`, `branding`, `avatars`).

## 4. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 (or whichever port Next picks).

## 5. Demo mode vs production

- **Demo mode** (`NEXT_PUBLIC_DEMO_MODE=true`): the login page shows the role-pick modal you saw on May 7. No real authentication needed. Useful for sales demos and UI work.
- **Production mode** (`NEXT_PUBLIC_DEMO_MODE=false`): real Supabase Auth. Users must sign in with email + password.

## 6. Create the first admin user

Once in production mode, signups default to `role='manager'`. To bootstrap the first admin:

1. Sign up via the login page with the admin's email + password.
2. In Supabase Studio → Table Editor → `profiles`, edit that user's row and set `role = 'admin'`.
3. Sign out and back in — the admin dashboard is now accessible.

## 7. Regenerating TypeScript types from the live schema

After applying the migration:

```bash
npx supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/types.ts
```

This replaces the hand-written stub at `src/lib/supabase/types.ts` with fully-typed table rows / inserts / updates.

## 8. Resend (transactional email)

BCJ Learn sends two layers of email:

- **Auth emails** (invitation, password reset) — handled by Supabase Auth.
- **App emails** (welcome, quiz result, overdue reminder, at-risk alert) — handled by `sendEmail()` in `src/lib/emails/send.ts`, using templates from the `email_templates` table.

### Configure Resend SMTP in Supabase

This is a one-time UI step in Supabase Studio:

1. Create a Resend account at resend.com.
2. Verify a sending domain (e.g. `bcj.com`) — add the DKIM / SPF / DMARC records Resend gives you to your DNS provider. Wait for verification.
3. Generate a Resend API key (Settings → API Keys).
4. In Supabase Studio → Project Settings → Auth → SMTP Settings, switch to **Custom SMTP**:
   - Host: `smtp.resend.com`
   - Port: `465` (or `2587`)
   - User: `resend`
   - Password: your Resend API key
   - Sender name: `BCJ Learn`
   - Sender email: `noreply@<your-verified-domain>`
5. Save.

After this, every invite / password-reset email from Supabase will be branded as BCJ Learn.

### Set the Resend env vars

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=BCJ Learn <noreply@bcj.com>
```

These are used directly by `sendEmail()` for app emails (quiz results etc.).

## 9. Anthropic Claude (AI question authoring)

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Per the SOW, Ten80Ten provides the key for the first 30 days of production; BCJ swaps to their own key afterwards. The key is server-side only — never exposed to the browser.

## 10. Deploying to Vercel

1. Push the repo to GitHub if not already (origin: `Furqan-Bunny/BCJ-Learn`).
2. Vercel dashboard → Add New Project → Import Git Repository → select the repo.
3. Framework is auto-detected as Next.js. Leave the build settings as default.
4. Add these env vars under "Environment Variables" (apply to Production + Preview + Development unless noted):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (mark Sensitive)
   - `NEXT_PUBLIC_DEMO_MODE` — `false` in Production, `true` in Preview/Development
   - `RESEND_API_KEY` (Sensitive)
   - `RESEND_FROM_EMAIL`
   - `ANTHROPIC_API_KEY` (Sensitive)
   - `NEXT_PUBLIC_APP_URL` — the Vercel-assigned URL (Production); per-deployment URL for previews
5. Deploy.
6. In Supabase Studio → Auth → URL Configuration, add the Vercel URLs to **Redirect URLs**:
   - `https://<your-vercel-url>/auth/reset-password`
   - `https://<your-vercel-url>/auth/accept-invite`
   - `https://<your-vercel-url>/auth/callback`

### Custom domain

When BCJ provides a domain (e.g., `academy.bcj.com`):

1. Vercel → Project → Domains → Add → enter the domain.
2. Add the CNAME record at the DNS provider as Vercel instructs.
3. Update `NEXT_PUBLIC_APP_URL` in Production env vars to the custom domain.
4. Re-add the custom domain's redirect URLs to Supabase Auth as in step 6 above.

## File layout (Supabase-related)

```
.env.local.example                  Template for env vars
.env.local                          Real values (git-ignored)
middleware.ts                       Next.js middleware (auth gate)
supabase/
  └── migrations/
      └── 0001_initial_schema.sql   Complete initial schema
src/lib/supabase/
  ├── client.ts                     Browser client
  ├── server.ts                     Server client + admin client
  ├── middleware.ts                 Session refresh helper
  └── types.ts                      Database types (regenerate from live schema)
src/lib/ai/
  ├── claude.ts                     Anthropic client wrapper
  └── prompts.ts                    Centralised Claude prompts
src/lib/emails/
  ├── resend-client.ts              Resend client wrapper
  ├── render.ts                     Markdown → HTML for email bodies
  └── send.ts                       sendEmail(): template + vars → Resend
```
