# Task Management — Handoff for a new Claude account

> Put this file in the repo root as `CLAUDE.md` (D:\NIS\NIS Claude\Task Management\CLAUDE.md) so Claude reads it automatically.
> Written 1 Oct 2026. State = commit `d46bb35` on `main`.

## 1. What it is

A personal daily task tracker (each account sees only its own data): tasks with category/priority/due time, **automatic roll-over** of unfinished tasks to the next day, multi-day ("long") tasks, reminders, undo/redo, calendar, Notes (categories → checklists / text notes / files & photos), summary + PDF, profile. Same data on website and Android app.

- **Owner:** Nazzas Ibn Shams Unib — GitHub `nazzasunib`, git email `mdnazzas@gmail.com`
- **Talk to the owner in Banglish** (Bangla in English letters), short and clear.
- **Website (live):** https://task-management-indol-eta.vercel.app
- **Android download page:** https://task-management-indol-eta.vercel.app/download
- **APK direct:** https://github.com/nazzasunib/Task-Management/releases/download/latest-apk/TaskManagement.apk
- **GitHub repo:** https://github.com/nazzasunib/Task-Management (branch `main`)
- **Local folder:** `D:\NIS\NIS Claude\Task Management`
- **Supabase project ref:** `mtavjysdnrqiarffiuhr` (separate from MealMate)
- **Vercel:** auto-deploys on every push to `main`.

## 2. Stack

- Next.js 15 + React 19. The whole app is **one React component file**: `components/TaskApp.jsx` (~3.5k lines).
- **Tailwind CSS is built live** here (`tailwind.config.js`, `postcss.config.mjs`), unlike MealMate — Tailwind classes work. Custom CSS in `app/globals.css`.
- Supabase: Auth, Postgres + RLS, private Storage bucket, Realtime broadcast.
- Android: Capacitor 8.5.2 WebView that loads the **live site** (`capacitor.config.json` → `server.url`), appId `com.niduslab.taskmanagement`, user-agent suffix `TaskManagementApp`.
- jsPDF + jspdf-autotable (loaded only when a PDF is downloaded).

## 3. Repo map

| Path | What |
|---|---|
| `components/TaskApp.jsx` | Everything: auth screens, Workspace, Dashboard, Today's Tasks, All Tasks (filters/sort), Calendar, Notes, Summary (PDF), Settings, modals (`ModalShell` renders through a **portal into document.body** — needed because page wrappers animate with transform), app-mode bottom bar (`BottomNav`, `APP_TABS`, `APP_MORE_KEYS`), file helpers. |
| `lib/store.js` | Data layer: loads `tm_tasks` / `tm_note_categories`, diff-syncs only changed rows, Realtime "changed" broadcast, task attachment upload, Notes files (`uploadNoteFile`, `signPaths`, `removeFiles`). |
| `lib/supabase.ts`, `lib/errors.ts` | Client + friendly errors. |
| `app/layout.tsx` | Early script adding `tm-app` class to `<html>` in app mode; iOS/PWA meta. |
| `app/globals.css` | Tailwind + custom styles; app-only rules are scoped to `html.tm-app`. |
| `app/download/page.tsx` | APK download page (Android steps, iPhone Add-to-Home-Screen steps). |
| `app/manifest.ts` | PWA manifest. |
| `supabase/migrations/0001_task_management.sql` | Tables `tm_profiles`, `tm_tasks`, `tm_note_categories` (notes stored as JSON per category, incl. file metadata), Storage bucket `tm-attachments` (private, **3 MB per file**, path must start with the user id), RLS: each user only their own rows/files. |
| `supabase/tests/test_rls.sql` | RLS tests (run on local Postgres after `stub_supabase.sql` + migration). |
| `android/…/DownloaderPlugin.java` | Native plugin: saves PDFs/attachments to `Download/Task Management` and opens them (WebView ignores normal downloads). |
| `.github/workflows/build-apk.yml` | Builds the APK on push (android/**, capacitor.config.json, package*.json) → release `latest-apk`. |
| `index.html`, `404.html`, `_config.yml` (repo root) | **GitHub Pages only** — retire the old browser-only version (it had separate localStorage accounts that caused "same email, two accounts" confusion). Not used by Vercel. Don't re-publish `legacy/`. |
| `legacy/index.html` | Original single-file app (reference). |

## 4. Features & decisions (don't break)

- **Website vs app UI:** app (Android, iPhone home-screen, or `?app=1`) gets a royal-navy bottom bar: Dashboard, Today's Tasks, Calendar, Notes, More (All Tasks, Summary, Settings); no sideways scrolling. Website layout (sidebar) must stay unchanged when the owner asks for app-only changes, and vice-versa.
- **APK loads the live site** → no rebuild for web changes; rebuild only for `android/**` etc. Users reinstall from `/download`.
- **Downloads in app** go through `saveFileInApp()` → native `Downloader` plugin; old APKs get an "update the app" message.
- **Completed tasks sink to the bottom** of lists (`completedLast()`), except All Tasks when sorted by status.
- **Notes files & photos:** "Files & Photos" card + 📎 on every checklist/text card. Files upload straight to `tm-attachments` under `<user>/notes/<card>/…`; card stores `{id,name,type,size,path}`; signed URLs for viewing; big photos auto-scaled to fit 3 MB; removing a card/file deletes the storage object unless a duplicated card still uses it.
- **Roll-over / long tasks / reminders** logic is from the original app — keep behaviour identical.
- Logo/app icon: the owner's checklist logo (`assets/icon.png`, `public/*.png`).

## 5. Ship flow

1. Edit in `D:\NIS\NIS Claude\Task Management`.
2. Build check (cloud or PC): `NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next build`
3. Test in a browser (Playwright with mocked Supabase routes; app mode = add `TaskManagementApp` to the user agent, width 390).
4. Commit + push from the owner's PC in **Windows PowerShell** (GitHub login lives there):
   ```powershell
   cd 'D:\NIS\NIS Claude\Task Management'
   git add <files>
   git -c user.name=nazzasunib -c user.email=mdnazzas@gmail.com commit -m "Short title" -m "What and why"
   git push origin main
   ```
   If git complains about `.git/HEAD.lock`, first confirm no git process is running, then remove the stale lock.
5. Vercel deploys in ~1 min — verify from the PC (cloud sandbox can't reach *.vercel.app).
6. If `android/**` changed: check GitHub Actions runs for `nazzasunib/Task-Management` and the `latest-apk` release.
7. Report in Banglish: what changed, whether a new APK or any SQL is needed.

## 6. Permissions / setup the new Claude account needs

1. Claude desktop app on the owner's PC; task linked to "this computer".
2. Connect folder `D:\NIS\NIS Claude\Task Management` (and `…\Meal Mate`) with read/write.
3. **Desktop Commander** (Windows PowerShell access) enabled — `git push` must run in Windows (Git Credential Manager signed in as `nazzasunib`). The Linux shell for connected folders can't push (no credentials).
4. Never ask for or type passwords/tokens.
5. Supabase schema changes: write a new migration file (`0002_….sql`), test it locally, give it to the owner — **he runs it in Supabase → SQL Editor** and replies "Done". Then verify via the anon key (function exists → 401 permission denied; missing → 404 PGRST202).
6. Vercel env vars already set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.

## 7. Owner's rules

- Ask clarifying questions (multiple choice) before big builds; small fixes: just do them.
- Respect "APK only" / "website only".
- CI fixes: root cause only — no random version changes, no `|| true`, no fake files.
- Don't delete user data unless explicitly asked. Never type passwords.
- Be clear about what was tested with mocks vs on a real phone.

## 8. Known leftovers

- APK is a debug build (not Play-Store signed). iPhone uses Safari "Add to Home Screen".
- Bucket limit is 3 MB per file; raising it needs an SQL change the owner runs.
