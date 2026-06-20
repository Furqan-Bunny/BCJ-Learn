# BCJ Learn — Admin Guide

*Complete reference for administrators. Admins have full access to every module, person, report, and setting.*

---

## 1. Dashboard

![The admin Program health dashboard](/docs-img/admin-dashboard.png)

`Dashboard` is your live program overview. **Everything is clickable** to drill in:

- **KPI cards** (click to drill down): **Total employees** → People, **Pass rate** → Test results (passed), **Average score** → Test results, **At-risk** → At-risk list. Each shows a trend delta.
- **Module-by-module performance** — a stacked bar chart (passed/failed per module). **Click a bar** to open that module's attempts.
- **Employee status** — donut of Active / Completed / At-risk / Inactive.
- **Cohorts/markets** — per market: totals, completed, at-risk, active, with progress bars.
- **Activity feed** — the 8 latest events (View all → Audit log).
- **At-risk panel** — the most at-risk employees; click to open a person, or "All" → At-risk.

---

## 2. Modules

### Modules list

![All modules](/docs-img/admin-modules.png)

`Modules` shows all modules (List or Card view, toggle persists). Each row shows its **Published / Draft** status and, once the module has been delivered (its seminar's session has ended), a green **"Delivered {date}"** badge. **Search** by number/title/description/month/owner. Click a module to open it. **Add module** opens the wizard.

### Add module (4-step wizard)
1. **Details & content** — module number (auto), **title**, **description**, **scheduled date** + optional **time**, **owner Department Lead(s)**, **pass threshold** (default 85%), **question count** (default 25), optional **time limit**, and optional **required resources** to link. Below, the **Lessons builder** (add lessons + content — see §3).
2. **Generate questions** — AI drafts questions one at a time; **Add** the good ones, **Skip** the rest. Toggle the **pool** (First attempt / Retake) as you go.
3. **Choose employees** — pick who attends. Everyone who hasn't passed in the last 12 months is **pre-checked**, and you can **search the full directory to add anyone else** (already-passed people show a "passed" hint and start unchecked). Leave empty to schedule later.
4. **Publish & send** — **Publish** (creates the module, links resources, schedules the seminar if you picked people, and emails invites in batches) **or** **Save as draft** (stays admin-visible, hidden from employees, publish later).

### Module detail page
Header has **Edit module** and **Open presenter**. A **Module setup panel** guides you: 1) Add content, 2) Generate & approve questions, 3) Choose employees & schedule, 4) **Publish / Unpublish**.

Tabs:
- **Overview** — KPIs (Attempts/Pass rate/Avg score/Failed, all clickable), the seminar plan + lessons, quick links (Question bank, Results, All attempts), and a sidebar: **Required resources** (link/unlink), **Module owners**, **Schedule** (day, length, pass threshold, quiz length), **Content tally**.
- **Content** — read-only lessons preview + **Edit content**.
- **Questions** — bank summary grouped by pool + **Review & edit questions**.
- **Roster** — who's expected for the current delivery; **Reschedule** / **Schedule redelivery**; the roster table (bulk add/remove, search/filter).
- **Past deliveries** — timeline of every delivery with attendance + session times. The current delivery is tagged **Active** (not yet presented), **Delivered {date}** (its seminar has ended but it stays open so people can retake), or **Archived** (superseded by a newer delivery).
- **Reports** — attempts table for this module + **Open full Test Results**.

### Edit module
Same fields as the wizard, pre-filled (number can't change). Edit details, owners, thresholds, lessons, and linked resources; **Save changes**.

### Publish vs Draft
A module appears to an employee only when it's **published AND they've been invited** to it (added to its roster) — publishing alone does **not** expose it to the whole company. **Draft** modules are visible to admins/leads but hidden from employees. Use **Unpublish** to pull a module back to draft. Publishing with fewer approved questions than the quiz length asks for a confirmation but is allowed.

---

## 3. Lessons & content builder

- **Add lesson** (title, description, duration). Reorder lessons with the arrows; delete with the trash.
- **+ Add content** → **Video / Document / Slides / Link**. Upload (video ≤ 2 GB, document/slides ≤ 50 MB) or paste a URL.
- Per item: **Edit** (title/duration/URL), **reorder**, **delete**, and the **eye toggle / "Don't show on presentation day"** (hides from the live presenter, keeps it as employee pre-study).
- **Version history** records every save with **who edited** + when, and lets you **restore**.

---

## 4. Question library

![The question library across all modules](/docs-img/admin-questions.png)

`Question library` spans all modules (a Department Lead sees only their own). Filter by **module**, **pool** (First attempt / Retake), **status** (Approved / Pending), and **search**. Paginated.

Per question you can **Approve**, **Edit**, **Regenerate with AI**, set **pool**, **Duplicate → retake**, view **Who answered** (who got it right/wrong, with date/time — searchable + paginated), view **History** (and restore), or **Reject**. Each shows **Attempts** and **Pass rate** (shows "—" with 0 attempts) and **Approved by**. **Generate with AI** drafts a fresh bank from the module's content.

---

## 5. Resources

![The Resources admin, organised into department folders](/docs-img/admin-resources.png)

`Resources` holds policies, SOPs, guides — anything non-quiz. Resources are organised into **department folders** (collapsible).

### Create / edit a resource
Fields: **Title**, **Department** (folder), **Category** (tag), **Description**, content as a **markdown body** OR an **uploaded file** OR an **external link**, **Audience** (Employees / Department Leads / Admins), **Markets** (empty = all), **Requires acknowledgement** toggle, and **Require re-acknowledgement on next update** (bumps the version so everyone must sign again and gets notified), and **Notify on update**.

### Resource detail page

![A resource's detail page — preview, change history, acknowledgements](/docs-img/admin-resource-detail.png)

Click a resource (or **View all details**) to open its page:
- **Preview** — renders the document/markdown/link.
- **Change history** — every edit: version, **who edited**, date/time, and **what changed** (a field-level diff). This is the audit trail.
- **Acknowledgements** — the current-version status (**X of Y acknowledged**, who's pending, with date/time) and a per-version **acknowledgement tree** showing who signed each version and when (re-acknowledgements branch as new version nodes). Both lists are paginated.
- **Edit** / **Delete** from the header.

> "Acknowledgement required" forces a read-and-understand sign-off. If a module links a resource as required, employees must sign it before that module's **quiz** unlocks.

---

## 6. People

### Employees (`People → Employees`)

![The Employees directory](/docs-img/admin-people.png)

A table of all employees: name, **markets**, **status** (Pending / Active / At-risk / Completed / Inactive), joined, last active. **Search** by name/email; **filter** by market and status. **Select rows** for bulk actions (**Send reminder** with a preview, **Remove**, **Resend invite**). Per person: open their detail, send a reminder, deactivate/reactivate, force password reset, delete.
- **Add employee** — name, email, market(s); sends an invite email.
- **Bulk import** — upload a CSV (`name,email,markets`; markets separated by `;`). Rows are validated; import the valid ones; invites send in batches.

### Employee detail
A person's profile, their assigned modules (status, attempts, pass rate), and **all their attempts** (click into any). Actions: send reminder, reschedule a retake, force password reset, deactivate, delete. **Editing a person lets you change their role** (Employee ↔ Department Lead ↔ Admin) — demoting a lead removes their module ownership — and for a still-**pending** invite you can **Resend invite**.

### Department Leads (`People → Department Leads`)
A table of leads: owned modules, question-bank progress, joined, last active. **Invite Department Lead** (name, email, title). Email / send reminder / delete per lead.

### Admins (`People → Admins`)
A table of admins (name, title, joined, last active). **Invite admin** (name, email, title). A note reminds you admins have full access — grant carefully.

### At-risk
`At-risk` lists auto-flagged employees (cards, paginated). A person is flagged when any of these is true: **failed twice on a module**, **missed a deadline**, **hasn't logged in 14+ days**, **first attempt below 70%**, or **no attempt on an assigned module**. Flags clear automatically when they pass a retake or log back in. **Send reminder** (with email preview) per person, or **Send reminder to all**. The **"What is at-risk?"** button explains the rules.

---

## 7. Reports & test results

![Test results — the master attempts table](/docs-img/admin-reports.png)

`Test results` is the master attempts table — every quiz attempt by **anyone**, including Department Leads or Admins who took a quiz themselves (not just employees):
- KPIs: total attempts, pass rate, average score, failed.
- Columns: employee, module, pool, **score**, status, **Attended** (checked-in vs not), date **with time**. Sort, filter (by module/pool/status), search by employee. Paginated. **Download CSV** exports the current view.
- Click a row to open the **attempt detail**: the score, correct/wrong counts, time taken, and a **question-by-question review** with the correct answers and the employee's choices. Actions: send reminder, schedule retake.

Per-module **Reports** (from the module page) add a score-distribution chart, most-missed questions, and the **roster — who attended & how they did**.

---

## 8. Audit log

![The audit log — filterable, sortable event history](/docs-img/admin-audit-log.png)

`Audit log` records every event (sign-ins, quiz pass/fail, module published, reminders, resource changes, sessions, etc.). **Search** the message, **filter by event type**, **filter by person**, and **sort** newest/oldest. **Clear** resets filters. Paginated. The log is append-only.

---

## 9. Notifications & email templates

![Email templates & reminder rules](/docs-img/admin-notifications.png)

`Notifications`:
- **Email templates** — edit the subject + markdown body of each automated email (invitation, password reset, welcome, quiz passed, quiz failed/retake, overdue reminder, at-risk alert, sign-in code, seminar scheduled/rescheduled). Insert **{{variables}}** like `{{name}}`, `{{module}}`, `{{score}}`, `{{date}}`, `{{link}}`. **Preview** the rendered email and **Send test** to yourself.
- **Reminder rules** — toggle **auto-reminders** and set the **overdue threshold** (days).

Anywhere you send a reminder (At-risk, People, a person's page), you first see an **email preview** and confirm before it sends.

---

## 10. Settings

### Branding (`Settings → Branding`)

![Branding settings](/docs-img/admin-settings-branding.png)

- **Platform name** (shown by the sidebar logo).
- **Brand colours** — primary (navy) + accent (teal), with a live preview.
- **Logo** — upload SVG/PNG/JPG/WebP.
- **Email sender** — the From address for all automated emails (must be on your verified sending domain).

### Certificate (`Settings → Certificate`)

![The certificate editor with live preview](/docs-img/admin-certificate-editor.png)

Fully customise the completion certificate with a **live preview**:
- **Heading**, **intro line**, **completion line**, **footer**.
- **Organisation name**, optional **signatory name** + **title**.
- **Show logo** toggle (uses the branding logo).
- Placeholders `{{name}}`, `{{module}}`, `{{score}}`, `{{date}}` fill in per employee.
Saved settings apply to every employee's certificate.

---

## 11. Seminars & deliveries

![Schedule a seminar — the due list is pre-checked, and you can search the directory to add anyone](/docs-img/admin-schedule-seminar.png)

- **Schedule a seminar / redelivery** — pick a **date + time** and the attendees. Everyone who hasn't passed in the last 12 months is pre-checked, and you can **search the directory to add anyone else**; invites email in batches. A module can have **multiple deliveries** (1st, 2nd, …); each attempt is tied to the delivery it happened in. **Rescheduling** the current delivery moves only that one; **scheduling a new delivery** creates the next one and archives the prior in **Past deliveries**.
- **Check-in** — opened by the Department Lead in the presenter; each session has a **fresh 4-digit code**. Attendance is recorded and shown on rosters and the attempted-vs-not column in reports.
- **Send the quiz to non-attendees** — quizzes open after the seminar; you can also send/open the quiz to selected people who didn't attend (talk to your team about policy).

---

## Admin tips & gotchas

- A module **must have an owner** (a Department Lead) and **published** status before employees see it.
- The AI reads content **after it's uploaded** — upload first, then generate questions.
- **Rejecting** a question is final; regenerate to get a new one. **Duplicate → retake** makes a reworded retake copy.
- Editing a resource with **re-acknowledgement** on **bumps its version** and asks everyone to sign again; the resource detail page shows the full history.
- **At-risk** flags are automatic (you can't set them by hand) and clear on their own.
- **Demo mode** (if enabled) shows "(demo)" toasts and doesn't send real emails.

*See the FAQ for quick answers.*
