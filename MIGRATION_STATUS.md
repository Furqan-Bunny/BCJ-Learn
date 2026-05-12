# BCJ Learn — Supabase Migration Status

## What's done (full Supabase wiring)

### Foundation
- ✅ Supabase project provisioned, schema applied (16 tables + RLS + storage buckets)
- ✅ `@supabase/supabase-js` + `@supabase/ssr` installed
- ✅ Client / server / middleware setup files (`src/lib/supabase/*`)
- ✅ Next.js middleware wired for auth gate (`middleware.ts`)
- ✅ `.env.local` configured; `.env.local.example` template committed

### Database
- ✅ Migration `0001_initial_schema.sql` — 16 tables, enums, RLS policies, triggers, SECURITY DEFINER quiz functions, storage buckets
- ✅ Migration `0002_add_avatar_url.sql` — profile pictures column
- ✅ Seed script (`scripts/seed.ts` + `npm run seed`) — populates dev DB with 67 users, 5 modules, 400 questions, 161 attempts, 64 activity entries

### Auth
- ✅ Real Supabase Auth on login page (production mode)
- ✅ Demo role-pick modal preserved behind `NEXT_PUBLIC_DEMO_MODE=true`
- ✅ `useCurrentUser()` hook — returns current user + profile (works in both modes)
- ✅ User menu — real `supabase.auth.signOut()`, avatar upload to `avatars` bucket
- ✅ `role-switcher` + `user-switcher` — hidden in production (`if (!DEMO_MODE) return null`)
- ✅ Middleware redirects unauthenticated routes to `/login` (production only)

### Data layer (`src/lib/db/`)
All helpers return the same shapes the existing UI components expect:

- ✅ `profiles.ts` — `listManagers`, `listTeachers`, `listAdmins`, `getProfile`, `listAllProfiles`
- ✅ `modules.ts` — `listModules`, `getModule`, `moduleTotalMinutes`, `moduleContentCounts`
- ✅ `attempts.ts` — `listAttempts`, `listAttemptsForManager`, `listAttemptsForModule`
- ✅ `activity.ts` — `listActivity`, `listRecentActivity`, `listNotificationsForRecipient`
- ✅ `questions.ts` — `listQuestionsForModule`
- ✅ `queries.ts` — `programStats`, `cohortBreakdown`, `moduleProgressBreakdown`, `scoreDistribution`, `atRiskManagers`, `filterManagers`

`dbClient()` in `src/lib/supabase/db-client.ts` picks the right Supabase client:
- Demo mode → admin (service-role) client, bypasses RLS
- Production → user-context server client, respects RLS

### Storage
- ✅ Three buckets live with RLS (`module-content`, `branding`, `avatars`)
- ✅ Helpers in `src/lib/supabase/storage.ts`:
  - `uploadModuleContent(slug, lessonId, file)` → upload manuals/slides/videos
  - `signedUrlForContent(path)` → 1-hour signed URL for private content
  - `uploadBrandingAsset(file, name)` → public BCJ logo upload
  - `uploadAvatar(userId, file)` → user profile picture upload (already wired into user-menu)

### Pages migrated to Supabase
- ✅ `/login` — real auth (when DEMO_MODE=false)
- ✅ `/admin/dashboard` — server component, fetches via db/queries.ts + db/activity.ts + db/profiles.ts. Split into `page.tsx` (server) + `dashboard-view.tsx` (client).

---

## What's still on mock data (Phase 4 follow-up)

All 21 remaining pages still import from `src/data/*` (mock files). They render correctly but show the mock seed embedded in TypeScript files — not the data in Supabase.

To migrate each page, follow the **admin/dashboard pattern**:

1. Move the existing rendering JSX into a new sibling `*-view.tsx` file with `"use client"`.
2. Accept the previously-imported data as props.
3. Rewrite the page's `page.tsx` as an `async` server component that:
   - Imports the matching `db/*` helpers
   - `await`s them in parallel via `Promise.all`
   - Renders the view component with the fetched data as props

### Pages remaining (grouped by role)

**Admin (8 pages)**
- `/admin/managers` (Employees table) — replace `from "@/data/users"` with `listManagers()`
- `/admin/managers/[id]` — replace single-manager lookup with `getProfile(id)` + `listAttemptsForManager(id)`
- `/admin/teachers` — `listTeachers()` + `listModules()` for owned-modules join
- `/admin/admins` — `listAdmins()`
- `/admin/at-risk` — `atRiskManagers()`
- `/admin/modules` — `listModules()`
- `/admin/modules/[slug]` — `getModule(slug)` + `listAttemptsForModule(slug)`
- `/admin/questions` — `listQuestionsForModule(slug)` per module
- `/admin/results` — `listAttempts()` joined with manager + module
- `/admin/results/[attemptId]` — single attempt + answers
- `/admin/notifications` — `listNotificationsForRecipient` for each manager
- `/admin/audit-log` — `listActivity()`
- `/admin/reports` — wiring is button-only; CSV/PDF export happens server-side

**Manager (5 pages)**
- `/manager/dashboard` — `listAttemptsForManager(currentUserId)` + `listModules()`
- `/manager/modules` — `listModules()` (published only)
- `/manager/modules/[slug]` — `getModule(slug)`
- `/manager/modules/[slug]/quiz` — call `supabase.rpc('start_quiz_attempt', ...)` server action
- `/manager/progress` — `listAttemptsForManager(currentUserId)`

**Teacher (8 pages)**
- `/teacher/dashboard` — `listModules()` filtered to owned, plus attempts for those
- `/teacher/modules` — `listModules()` filtered to owned
- `/teacher/modules/[slug]` — `getModule(slug)`
- `/teacher/modules/[slug]/content` — `getModule(slug)` with lessons
- `/teacher/modules/[slug]/questions` — `listQuestionsForModule(slug)`
- `/teacher/modules/[slug]/results` — `listAttemptsForModule(slug)`
- `/teacher/modules/[slug]/present` — `getModule(slug)` for the seminar runner
- `/teacher/results` — `listAttemptsForModule(slug)` per owned module
- `/teacher/managers` (My team) — `listManagers()` filtered to owned modules' enrollees
- `/teacher/questions` — `listQuestionsForModule(slug)` per owned module

### Mutations still to wire
- Admin sheets (Add Employee, Add Module, Bulk Import) currently toast a fake success.
  Switch to Supabase `.insert()` calls via Server Actions.
- Lessons builder content upload → use `uploadModuleContent()` from `storage.ts`.
- Branding settings logo upload → `uploadBrandingAsset()`.

---

## How to test now

### Demo mode (default)
```
NEXT_PUBLIC_DEMO_MODE=true        # in .env.local
npm run dev
```
Login page shows role-pick modal. The migrated `/admin/dashboard` reads from Supabase (you'll see the 67 seeded employees + 161 attempts). Every other page still shows mock data.

### Production mode
```
NEXT_PUBLIC_DEMO_MODE=false       # in .env.local
npm run dev
```
Login page shows real form. Sign in with any seeded email (e.g., `nancy@bcj.com`) + password `BcjLearnDemo2026!`. Admin dashboard renders real data. Other pages still render mock data (until migrated per the pattern above).

---

## Estimated remaining effort

Each page in the list above is ~15–30 minutes of mechanical work using the admin/dashboard template:

- Admin pages: 12 × 20 min ≈ **4 hours**
- Manager pages: 5 × 20 min ≈ **1.5 hours**
- Teacher pages: 10 × 20 min ≈ **3 hours**
- Mutation wiring (sheets, uploads): ≈ **2 hours**

**Total: ~10–12 hours** to reach full production-mode operation.

The platform is otherwise structurally complete — the foundation is solid, the pattern is proven, and the remaining work is repetitive page-by-page application of that pattern.
