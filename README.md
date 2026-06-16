# BCJ Learn — Frontend

Custom Employee training & quiz platform for BCJ. Built with Next.js 16, Tailwind v4, shadcn/ui, and TanStack Table. Hosted on Vercel.

This app runs on a full **Supabase** backend — Postgres (with RLS), Auth, Storage, and email — driven by Server Actions and SECURITY DEFINER RPCs. Setting `NEXT_PUBLIC_DEMO_MODE=true` switches on a demo path that bypasses the auth gate and skips real email/AI sends for sales demos and UI work; production runs with it `false`. See `SETUP.md` for configuration.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you'll be redirected to the login screen.

Sign in (any email/password works in demo mode), then pick a role to enter:

- **Employee** — take quizzes, study modules, track progress
- **Department Lead/Manager** — review AI-drafted questions, see module results
- **Admin** — full program oversight, dashboards, reporting, at-risk triage

You can switch roles any time from the topbar.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| UI primitives | shadcn/ui (base-ui adapter) |
| Tables | TanStack Table v8 (search / filter / sort / pagination) |
| Charts | Recharts |
| Forms | react-hook-form + zod |
| Animations | framer-motion |
| Toasts | sonner |
| Command palette | cmdk (Cmd+K) |
| Theme | next-themes (light / dark / system) |
| State | Zustand |
| Mock data | TypeScript files seeded with @faker-js/faker |
| Fonts | Geist Sans + Geist Mono |

## Project layout

```
src/
├── app/
│   ├── (auth)/login/         # Login screen with role-pick demo modal
│   ├── (app)/                 # Authenticated app shell (sidebar + topbar)
│   │   ├── manager/           # 7 manager pages
│   │   ├── teacher/           # 5 teacher pages
│   │   └── admin/             # 9 admin pages
│   ├── layout.tsx
│   └── globals.css            # Tailwind + brand tokens (navy + gold)
├── components/
│   ├── ui/                    # shadcn primitives
│   ├── layout/                # Sidebar, Topbar, RoleSwitcher, CommandPalette, ThemeToggle
│   └── shared/                # PageHeader, KpiCard, StatusBadge
├── data/                      # Mock data (managers, modules, questions, attempts, activity)
├── store/                     # Zustand role store
├── types/                     # Domain types
└── lib/                       # cn(), formatting helpers
```

## Modern features

- **Cmd+K command palette** — jump to any page, switch role, change theme
- **Role switcher** — top-right, persists via localStorage
- **Dark mode** — system / light / dark toggle, no flash
- **Search + faceted filters + sortable columns** on the Managers data table
- **Toast notifications** for every action
- **Skeleton loaders** and animated transitions
- **Mobile-responsive** — sidebar collapses on small screens

## Brand colors

- Primary navy: `#1F3A5F`
- Gold accent: `#C89B5C`
- Status: emerald (pass), amber (at-risk), rose (fail), violet (AI-generated)

## Deploy on Vercel

```bash
git init
git add .
git commit -m "Initial BCJ Learn frontend"
git remote add origin <your-github-repo>
git push -u origin main
```

Then import the repo at [vercel.com/new](https://vercel.com/new). The build is zero-config — Vercel auto-detects Next.js.

---

**Prepared by Ten80ten** — May 2026.
