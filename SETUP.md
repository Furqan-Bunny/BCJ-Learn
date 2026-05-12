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
```
