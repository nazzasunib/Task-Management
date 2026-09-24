# Task Management — Next.js + Supabase + Vercel

Your original Task Management app is here with every page, rule, colour and calculation from `legacy/index.html`: auto roll-over, long tasks, reminders, undo/redo, calendar, notes, summary PDF and profile. It now has real accounts and saves everything to the cloud, so it's synced on every device.

## Setup
1. **Supabase → SQL Editor → New query**: paste all of `supabase/migrations/0001_task_management.sql` and click **Run**. Every table is prefixed `tm_`, so it can share a project with MealMate.
2. **Authentication → URL Configuration**: set the Site URL to your Vercel link, and add `https://YOUR-APP.vercel.app/**` to Redirect URLs.
3. **Vercel → Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SITE_URL`, then Redeploy.

Local development: `cp .env.example .env.local && npm install && npm run dev`

## What changed from the HTML
| Before (localStorage) | Now |
|---|---|
| `momentum.users.v1` (base64 passwords) | Supabase Auth: sign up, log in, forgot/reset password, email change |
| `momentum.session.v1` | Supabase session (stays signed in) |
| `momentum.tasks.<user>.v1` | `tm_tasks` table |
| `momentum.notes.<user>.v2` | `tm_note_categories` table (checklists stored as JSON per category) |
| Task attachments as base64 | Private Storage bucket `tm-attachments` (`<user>/<task>/<file>`) |
| Profile, photo, about | `tm_profiles` |
| `lastcheck` / `notified` | Stay on each device. They only guard roll-over and reminders. |

- **Security:** Row Level Security means each account can read and write **only its own rows and files**.
- **Sync:** changes save instantly (only changed rows are sent). Your other devices are told via Supabase Realtime and refresh; they also refresh on focus and every 60 seconds. The header shows **Synced / Saving / Offline / Not saved**.
- **Speed:** the page is static on Vercel's CDN, the app code is split, and the PDF libraries load only when you download a PDF.
- **Design:** stat cards use the royal-navy gradient card colour. The login page, splash screen, buttons and page transitions got new animations.

## Tests run
- `supabase/tests/test_rls.sql`: a user can't insert, update, delete or read someone else's rows, and can't edit their email directly.
- End-to-end in Chromium against real Postgres + PostgREST, with no console errors:
  - Accounts: signup validation, wrong password, welcome tasks seeded once, second device doesn't re-seed.
  - Data: add task with attachment (uploaded to Storage), notes, Clear All Data syncs to the server.
  - Settings: profile save, password change (wrong current password is rejected), summary PDF, logout.
  - Security: another account gets 0 rows through the API.
