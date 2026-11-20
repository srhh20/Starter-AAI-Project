# Login – Design

> **This file answers:** How is the app put together? (data, rules, screens,
> where the code lives)
> **Who:** The AI drafts it. You review all of it.
>
> If this file and the requirements disagree, fix the requirements first,
> then this file.

Designs login only, matching `01-requirements.md` (U1–U8, AC-01–AC-14). The
leave-request tables, screens and rules get their own design pass later; only
what login needs is here.

## 1. Tables

### `User` – one row per person who can log in

| Field | Type | Required? | What it holds |
|-------|------|-----------|---------------|
| `id` | number | auto | Unique number for the row |
| `name` | text | yes | Full name, as in brief 7.2 |
| `icNo` | text | yes | Identity card number, `xx-xxxxxx`, unique |
| `email` | text | yes | Work email, unique. Stored lowercase; login lookup lowercases first (AC-05) |
| `passwordHash` | text | yes | bcrypt hash from bcryptjs. Never the plain password, never shown in the UI |
| `role` | text | yes | One of `Employee`, `Supervisor`, `HR`, `Admin` as text (SQLite has no enum; the code rejects any other value). One role per user |
| `division` | text | yes | One of the divisions in Reference A. Needed by the leave spec later; login only displays it |
| `designation` | text | yes | Job title from Reference A |
| `createdAt` | date | auto | Set automatically when the row is created |

Login stores nothing else. Failed-login counting happens in memory, not in
the database (see rule 6). A `LoginAttempt` table is deliberately avoided:
the app is single-user-per-laptop for the demo, so a `Map` in the server
process is enough, and the lockout clearing on restart is acceptable.

The session is not stored server-side at all: it lives in the signed cookie
(rule 7). There is no `Session` table.

## 2. Business rules

1. **One door in.** The only way to become signed in is the `/login` form.
   The server lowercases the email, checks it matches the @budiman.com
   pattern (U7), finds the user by email, and compares the password against
   `passwordHash` with bcryptjs. No sign-up, password change or reset exists.
2. **Failures say nothing.** Unknown email, wrong password and locked-out
   race all answer with the same generic message (AC-02/AC-03). When the
   email is unknown the code still runs a throwaway bcrypt comparison so the
   two paths take similar time.
3. **Lockout per email.** Five consecutive failures for one email block that
   email for 15 minutes — correct password included (AC-06). A successful
   sign-in resets its counter; other emails are unaffected. The counters live
   in the server process (cleared by restarting `npm run dev`).
4. **Passwords are only ever hashed.** bcryptjs hashes at seed time and
   compares at login. `password123` for the demo accounts is the brief's
   mandated exception (requirements §5), not a policy.
5. **The cookie carries a user id and nothing else.** After a good login the
   server sets cookie `hrms_session`: a JSON payload `{uid, exp}` (expiry =
   login + 8 hours), encoded and signed HMAC-SHA256 with `SESSION_SECRET`
   using Node's built-in `node:crypto`. No role, no name, no email inside —
   the browser learns nothing the code would trust.
6. **Every page and action re-checks against the database.** A shared helper
   reads the cookie, verifies the signature and expiry (AC-11, AC-13), loads
   the `User` row, and checks the `role` in the database — never from the
   cookie (U2). Pages call `requireUser()`/`requireRole()`; every server
   action calls it again before doing anything. `src/proxy.ts` adds a cheap
   first gate (redirect obvious anonymous/tampered requests to `/login`),
   but with proxy removed the page-level checks still enforce everything.
7. **Cookie flags.** `httpOnly`, `sameSite=lax`, `path=/`, and `secure`
   whenever the request is HTTPS (AC-12). Set only inside a server action
   (`cookies()` in this version is async and writable only in server
   functions).
8. **Role routing, silent bounce.** After login, and for `/` and `/login`
   when already signed in, the server redirects by role: Employee →
   `/employee`, Supervisor → `/supervisor`, HR → `/hr`, Admin → `/admin`
   (U1, U8). Opening another role's page redirects to your own home — no 403
   page (AC-07). Anonymous access to any protected page → `/login` (AC-08).
9. **Sign out confirms, then reports.** The header button asks "Are you sure
   you want to sign out?" client-side; confirming runs a server action that
   deletes the cookie and redirects to `/login?msg=signedout`, which shows a
   "You have been signed out" banner (U5, AC-10). Cancelling keeps the
   session. Because the cookie is gone, the Back button can only reach
   `/login` again.
10. **Secrets are environment-only.** `SESSION_SECRET` (≥32 chars) and
    `DATABASE_URL` live in `.env` (git-ignored). The app refuses to start
    without `SESSION_SECRET` rather than using a hard-coded key.

## 3. Technology

| Part | Choice | In plain words |
|------|--------|----------------|
| Framework | Next.js 16.4.6 (App Router, TypeScript) | Pages and server logic in one project, as the brief fixes |
| Sessions | Hand-rolled signed cookie (`node:crypto` HMAC) | The brief's "signed session cookie" — no auth library, no new packages |
| Passwords | bcryptjs (pinned 3.0.3) | Hash at seed, compare at login |
| Database | SQLite file `prisma/dev.db` via Prisma 6.19 | One data file, no server to install |
| Styling | Tailwind CSS 4 | Styles next to each screen |
| Forms & actions | Server actions with `useActionState` | Login form posts to the server; no separate API (brief 7.1) |
| Requests guard | `src/proxy.ts` (Next 16's replacement for the deprecated `middleware.ts`) | Cheap redirect layer before pages render |
| Seed | `prisma/seed.ts` run by `tsx` (both already in the project) | One command loads the demo users |

No package may be added or upgraded (AGENTS.md); everything above is already
in `package.json` except the `prisma` seed config and an `npm run db:seed`
script, which are configuration, not dependencies.

## 4. Screens (routes)

| Route | Who | What it shows | Status |
|-------|-----|---------------|--------|
| `/` | Anyone | Server-side redirect only: signed in → own home; anonymous → `/login` | To do |
| `/login` | Anonymous | Email + password form, "Sign in" button, generic error text, format hint, lockout notice, "You have been signed out" banner after sign-out. Signed-in visitors are redirected to their home | To do |
| `/employee` | Employee | Login-stage placeholder: header with name + role + Sign out, and a "Your leave requests will appear here" panel | To do |
| `/supervisor` | Supervisor | Same placeholder shell, worded for the signature queue | To do |
| `/hr` | HR | Same placeholder shell, worded for the Pending-HR queue | To do |
| `/admin` | Admin | Same placeholder shell, worded for the all-records view | To do |

The four home pages share one authenticated layout (header with the signed-in
name, role and Sign out button) via a route group. Each page checks its own
role before rendering, so typing another role's URL bounces to your home.

## 5. Where the code lives

| Folder / file | What's in it |
|---------------|--------------|
| `prisma/schema.prisma` | The `User` model from §1; SQLite datasource using `DATABASE_URL` |
| `prisma/seed.ts` | Deletes all users, re-inserts the six demo users from Reference B, hashing `password123` with bcryptjs (AC-14) |
| `.env` | `DATABASE_URL`, `SESSION_SECRET` (git-ignored; `.env.example` added with placeholders) |
| `package.json` | Add `db:seed` script and the `prisma.seed` config pointing at `prisma/seed.ts` — no new packages |
| `src/lib/prisma.ts` | Single shared `PrismaClient` instance |
| `src/lib/session.ts` | Create, sign (HMAC-SHA256), verify and decode the `hrms_session` cookie value; 8-hour expiry honoured via `SESSION_MAX_AGE_SECONDS` for AC-11 |
| `src/lib/auth.ts` | `getServerUser()` and `requireUser()` / `requireRole(role)` — the DB-checking gatekeepers used by every page and action; plus the login check itself (bcrypt compare, generic-error + dummy-compare path, lockout call) |
| `src/lib/login-throttle.ts` | In-memory 5-failures/15-minutes lockout map keyed by email |
| `src/lib/validation.ts` | Server-side checks: email shape (@budiman.com), non-empty password, IC format. Hand-written — no validation package |
| `src/app/actions/auth.ts` | Server actions: `signIn(formData)` (validate → throttle check → bcrypt compare → set cookie → redirect to role home) and `signOut()` (delete cookie → redirect `/login?msg=signedout`) |
| `src/proxy.ts` | Next 16 proxy (replaces `middleware.ts`): redirect anonymous/tampered requests on protected routes to `/login`; never decides roles |
| `src/app/login/page.tsx` | Login page: form, error/success banners (reads `msg` query param) |
| `src/app/page.tsx` | Replace the starter page with the role redirect |
| `src/app/(authed)/layout.tsx` | Authenticated shell: calls `requireUser()`, renders header + Sign out button |
| `src/app/(authed)/employee/page.tsx` | Employee home placeholder; starts with `requireRole('Employee')` |
| `src/app/(authed)/supervisor/page.tsx` | Supervisor home placeholder; `requireRole('Supervisor')` |
| `src/app/(authed)/hr/page.tsx` | HR home placeholder; `requireRole('HR')` |
| `src/app/(authed)/admin/page.tsx` | Admin home placeholder; `requireRole('Admin')` |
| `src/components/SignInForm.tsx` | Client component: `<form action>` + `useActionState` for inline errors and a pending state |
| `src/components/SignOutButton.tsx` | Client component: confirm dialog, then calls the `signOut` action |

## 6. Security (in plain words)

- **Pages:** every page under `(authed)` runs `requireUser()` →
  `requireRole()` in its server code: valid signature, not expired, user
  exists, role matches — or a redirect (U2, OWASP A01).
- **Actions:** both server actions re-run the same checks; `signOut` is
  harmless without a session. The login action validates on the server
  regardless of anything the browser sent.
- **Nothing trusted from the browser:** only the session cookie is read; its
  signature is verified with HMAC before its `uid` is believed, and the
  `uid` only selects a database row whose role decides access (AC-13).
- **Passwords:** bcrypt hashes only; the login check compares and never logs
  or echoes passwords (A02). Unknown emails still burn a bcrypt comparison
  so probing can't time the difference (A07).
- **Guessing resistance:** generic error + 5/15-minute per-email lockout
  (A07).
- **Cookie:** `httpOnly` (XSS can't read it), `sameSite=lax` (CSRF), `path=/`,
  `secure` on HTTPS; fixed 8-hour expiry (A05).
- **Secrets:** `SESSION_SECRET` only in `.env`, never committed; app refuses
  to boot without it.
- **Proxy layer:** defence in depth for anonymous redirects only — deleting
  `src/proxy.ts` must not open any page to the wrong user.

## 7. Commands

| Command | What it does |
|---------|--------------|
| `npm install` | Install the pinned dependencies |
| `npx prisma db push` | Create/update the SQLite database from the schema |
| `npm run db:seed` | Load the six demo users, hashed (AC-14) |
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run lint` | Must pass before any task is called done |
| `npm run build` / `npm start` | Production build and run |

---

# Reference

> Long lists you look things up in (fixed choices, demo data). Keep them here
> so the rules above stay short.

## Reference A. Fixed lists

- **Roles:** Employee, Supervisor, HR, Admin
- **Divisions and designations** (from brief 7.2; login stores them, the
  leave spec will use them to pick supervisors):
  - **Finance:** Finance Manager, Accountant, Accounts Clerk
  - **Human Resources:** HR Manager, HR Officer, HR Assistant
  - **Information Technology:** IT Manager, Software Developer, IT Support Officer
  - **Operations:** Operations Manager, Operations Supervisor, Operations Executive
  - **Marketing:** Marketing Manager, Marketing Executive, Marketing Assistant
  - **Admin:** Admin Manager (division for the admin account; not in the
    brief's five-division list, taken from the demo table in 7.2)

## Reference B. Demo data (seeded by `prisma/seed.ts`, brief 7.2)

All accounts share the password `password123`, stored bcrypt-hashed.

| Email | Name | IC No. | Role | Division | Designation |
|-------|------|--------|------|----------|-------------|
| `employee-1@budiman.com` | Employee 1 | 00-148888 | Employee | Finance | Accounts Clerk |
| `supervisor-1@budiman.com` | Supervisor 1 | 00-157777 | Supervisor | Finance | Finance Manager |
| `supervisor-2@budiman.com` | Supervisor 2 | 00-166666 | Supervisor | Finance | Accountant |
| `hr-1@budiman.com` | HR 1 | 00-175555 | HR | Human Resources | HR Officer |
| `hr-2@budiman.com` | HR 2 | 00-184444 | HR | Human Resources | HR Officer |
| `admin@budiman.com` | Admin | 00-193333 | Admin | Admin | Admin Manager |
