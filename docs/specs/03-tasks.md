# Login – Tasks

> **This file answers:** In what order do we build it, and how do we check each step?
> **Who:** The AI drafts it. You review it.
>
> Build one task at a time, in order. When a task is done, the AI changes its
> Status to Done. At the end, you check the whole app against the specs.
> If something is wrong, fix the spec first, then ask the AI to rebuild.

**Priority.** Every task is **High**, **Medium** or **Low**. Do High first.
Do Low only if time is left, and only if you ask.

Each task traces back to `01-requirements.md` (U#/AC#), `02-design.md`
(§number) and the HRMS brief (section number). Commit each task separately
with a conventional-commit message, asking permission first (brief 7.3).

| Status | # | Task | Priority | Checks (from requirements §4) |
|--------|---|------|----------|-------------------------------|
| To do | 1 | Create the database and the Users table | High | — (enables everything; design §1) |
| To do | 2 | Seed the six demo users | High | AC-14 |
| To do | 3 | Signed session cookies | High | AC-11, AC-13 (foundation) |
| To do | 4 | Server-side checks: validation and lockout | High | AC-04, AC-06 (foundation) |
| To do | 5 | Sign in: login page and sign-in action | High | AC-02–AC-06, AC-12 |
| To do | 6 | The four role homes and the gatekeeper | High | AC-01, AC-07–AC-09, AC-11, AC-13 |
| To do | 7 | Sign out with confirmation | High | AC-10 |
| To do | 8 | proxy.ts defence in depth | Medium | AC-08 (second layer) |
| To do | 9 | Full sweep of the acceptance checklist | High | AC-01–AC-14 |

---

## Task 1 – Create the database and the Users table *(High)*

> One task = one small step you can finish and test on its own.

- **Goal:** A SQLite database exists with an empty `User` table holding every
  field from the design, reachable through Prisma.
- **Files:** create `prisma/schema.prisma` (the `User` model: name, unique
  `icNo`, unique lowercase `email`, `passwordHash`, text `role`, `division`,
  `designation`, auto `createdAt`), `.env` and `.env.example`
  (`DATABASE_URL`, `SESSION_SECRET`), `src/lib/prisma.ts` (shared client);
  check `.gitignore` covers `.env` and `prisma/dev.db`.
- **Check:** `npx prisma db push` succeeds and creates `prisma/dev.db`.
  Open `npx prisma studio`: the User table shows exactly the fields above,
  email and IC are marked unique. `npm run lint` passes.
- **Traces:** design §1 (User table), §7 (commands); brief 7.2 (Users
  fields), 7.1 (SQLite + Prisma).

## Task 2 – Seed the six demo users *(High)*

- **Goal:** One command clears the Users table and loads the six people from
  the brief, with `password123` bcrypt-hashed.
- **Files:** create `prisma/seed.ts` (delete all users, insert the Reference
  B rows, hash the password with bcryptjs); edit `package.json` (add
  `db:seed` script + `prisma.seed` config pointing at it — no new packages).
- **Check:** run `npm run db:seed` twice. In `npx prisma studio`: exactly
  six rows matching brief 7.2 (emails, names, ICs, roles, divisions,
  designations), no duplicates after the second run, every `passwordHash`
  starts with `$2` and nowhere equals `password123`.
- **Traces:** U6, AC-14; design §1, §5 (`prisma/seed.ts`), Reference B;
  brief 7.2 (demo people, shared password).

## Task 3 – Signed session cookies *(High)*

- **Goal:** A library that creates, signs (HMAC-SHA256 with `SESSION_SECRET`),
  verifies and decodes the `hrms_session` payload `{uid, exp}` — and refuses
  to work without the secret.
- **Files:** create `src/lib/session.ts` (create/verify functions; 8-hour
  expiry honoured; `SESSION_MAX_AGE_SECONDS` overrides it for testing).
- **Check:** with a scratch script run via `npx tsx`: signing a payload and
  verifying it returns the payload; changing one character of the signed
  string → verify returns "invalid"; a payload with a past `exp` → verify
  returns "expired"; with `SESSION_SECRET` unset → the library throws. The
  scratch script is deleted afterwards.
- **Traces:** U4, AC-11, AC-13 (foundation — pages use this in Task 6);
  design §2 rules 5/7, §5 (`src/lib/session.ts`); brief 7.1 (signed session
  cookie).

## Task 4 – Server-side checks: validation and lockout *(High)*

- **Goal:** The server can say "not a @budiman.com email", count five failed
  logins per email and lock that email for 15 minutes — before any browser
  page exists.
- **Files:** create `src/lib/validation.ts` (email shape, non-empty password,
  IC format — hand-written, no new package) and `src/lib/login-throttle.ts`
  (in-memory fail counter and lock until timestamp, reset on success); start
  `src/lib/auth.ts` with the login check: look up by lowercased email, bcrypt
  compare, throwaway compare when the email is unknown so both paths take
  similar time.
- **Check:** scratch script via `npx tsx`: `alice@gmail.com` rejected,
  `employee-1@budiman.com` accepted as a shape; five failed `checkLogin`
  calls for employee-1 then the correct password also refused, while hr-1
  still signs in; a success resets the counter. Delete the scratch script.
- **Traces:** U3, U7, AC-04, AC-06; design §2 rules 1–3, §5 (validation,
  throttle); brief 7.2 (email always @budiman.com), 7.5 + OWASP A07.

## Task 5 – Sign in: login page and sign-in action *(High)*

- **Goal:** `/login` shows a working form; correct credentials set the
  `hrms_session` cookie with the right flags and issue the role redirect;
  wrong credentials show only the generic message.
- **Files:** create `src/app/login/page.tsx`, `src/components/SignInForm.tsx`
  (client, `<form action>` + `useActionState`, inline errors, disabled
  button while pending), `src/app/actions/auth.ts` (`signIn`: validate →
  throttle → bcrypt compare → set cookie → redirect to the role home).
- **Check:** as each demo user with `password123`: sign-in succeeds and the
  browser is sent to `/employee` etc. (a 404 is expected until Task 6 — what
  you check here is the redirect and the cookie). Wrong password →
  "Invalid email or password"; unknown email → identical message;
  `alice@gmail.com` → the Budiman-email hint; `EMPLOYEE-1@BUDIMAN.COM` →
  signs in; 5 failures then even the correct password is refused with the
  lockout notice, hr-1 unaffected. DevTools → Application → Cookies:
  `HttpOnly`, `SameSite=Lax`, `Path=/`.
- **Traces:** U1, U3, U7, AC-02–AC-06, AC-12; design §2 rules 1–3/5/7, §4
  (`/login`), §5; brief FR-01 (first half), 7.1, 7.2.

## Task 6 – The four role homes and the gatekeeper *(High)*

- **Goal:** The four home pages exist behind a shared authenticated layout;
  a page or its redirect only opens for the matching role, decided by the
  database — anonymous visitors are bounced to `/login`.
- **Files:** create `src/app/(authed)/layout.tsx` (`requireUser()`; header
  with name, role, and a disabled sign-out placeholder for now), the four
  pages `src/app/(authed)/{employee,supervisor,hr,admin}/page.tsx` (each
  starts `requireRole(...)`, placeholder panel per design §4); finish
  `src/lib/auth.ts` with `getServerUser`/`requireUser`/`requireRole`;
  replace `src/app/page.tsx` with the role redirect.
- **Check:** sign in as employee-1 → lands on `/employee` with name and role
  in the header; `/supervisor`, `/hr`, `/admin` typed by hand all bounce back
  to `/employee`. hr-1, admin, supervisor-1 likewise land and bounce. With
  no cookie (private window), all four URLs redirect to `/login`. Signed in,
  `/` and `/login` redirect to your home. Edit the cookie in DevTools (or
  swap one user's for another's) → bounced to `/login`, no stack trace. Set
  `SESSION_MAX_AGE_SECONDS=60`, sign in, wait, open `/employee` →
  `/login`.
- **Traces:** U1, U2, U4, U8, AC-01, AC-07–AC-09, AC-11, AC-13; design §2
  rules 6/8, §4, §5 (`(authed)`, `auth.ts`); brief 5.3 rule 1, FR-01, 7.5,
  OWASP A01.

## Task 7 – Sign out with confirmation *(High)*

- **Goal:** The header's Sign out button asks "Are you sure you want to sign
  out?", clears the cookie on confirm, and `/login` reports "You have been
  signed out".
- **Files:** create `src/components/SignOutButton.tsx` (client: confirm,
  then submit); add `signOut()` to `src/app/actions/auth.ts`; wire the button
  into `src/app/(authed)/layout.tsx`; make `src/app/login/page.tsx` show the
  banner for `?msg=signedout`.
- **Check:** as admin: click Sign out → dismiss the prompt → still signed in;
  click again → confirm → on `/login` with the success banner; browser Back
  → bounced to `/login`, never into `/admin`.
- **Traces:** U5, AC-10; design §2 rule 9, §5; brief 5.3 rule 7, FR-07.

## Task 8 – proxy.ts defence in depth *(Medium)*

- **Goal:** Before any page renders, requests carrying no (or an
  unverifiable) session cookie on protected routes get a redirect to
  `/login` from the Next 16 proxy layer — with roles still decided only by
  the database, and the page checks unchanged.
- **Files:** create `src/proxy.ts` (export `proxy` + `config.matcher`
  covering the four homes, `/` and `/login`, excluding `_next` and static
  files; verify signature/expiry with `src/lib/session.ts` only — no DB
  calls).
- **Check:** signed out, request `/admin` in a new tab: DevTools Network
  shows the 302 before any page HTML. Then temporarily rename `src/proxy.ts`
  and repeat AC-08 — the page-level checks must still bounce everything,
  proving this layer is only defence in depth. Restore the file.
- **Traces:** AC-08 (second layer); design §2 rule 6, §3 (proxy row), §5,
  §6 (proxy bullet); brief 7.1 (login design).

## Task 9 – Full sweep of the acceptance checklist *(High)*

- **Goal:** Login is done and provably matches the specs: every row of
  `01-requirements.md` §4 has been walked by hand on the demo accounts.
- **Files:** none new. Fix (or spec-fix first, then fix) anything the sweep
  finds.
- **Check:** run AC-01 → AC-14 in order with the six demo accounts, tick
  each row's Status in `01-requirements.md`; `npm run lint` and
  `npm run build` pass clean.
- **Traces:** all of U1–U8 and AC-01–AC-14; brief 7.4 (check against the
  specs), plan step 6.
