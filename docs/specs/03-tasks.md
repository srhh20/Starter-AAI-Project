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
| Done | 1 | Create the database and the Users table | High | — (enables everything; design §1) |
| Done | 2 | Seed the six demo users | High | AC-14 |
| Done | 3 | Signed session cookies | High | AC-11, AC-13 (foundation) |
| Done | 4 | Server-side checks: validation and lockout | High | AC-04, AC-06 (foundation) |
| Done | 5 | Sign in: login page and sign-in action | High | AC-02–AC-06, AC-12 |
| Done | 6 | The four role homes and the gatekeeper | High | AC-01, AC-07–AC-09, AC-11, AC-13 |
| Done | 7 | Sign out with confirmation | High | AC-10 |
| Done | 8 | proxy.ts defence in depth | Medium | AC-08 (second layer) |
| Done | 9 | Full sweep of the acceptance checklist | High | AC-01–AC-14 |

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

---

# Leave Request – Tasks

> **This file answers:** In what order do we build the leave module, and
> how do we check each step?
> **Who:** The AI drafts it. You review it.
>
> Same rules as the login tasks above: one task at a time, in order; the
> AI flips Status to Done; commit each task separately with a
> conventional-commit message, asking permission first (brief §7.4).

**Priority.** The brief's build order (§6): **High first, then Medium,
then Low** — the Low tasks are the extras X1–X6 (§1.2: "Extra ideas are
Low priority"), built only if time remains and you ask, like login's
task 8. The final sweep is High but runs last, exactly as login task 9.

This builds `01-requirements.md` (U9–U22, AC-15–AC-31). Below,
**§-numbers refer to the Leave Request – Design section** of
`02-design.md`, not the login one.

| Status | # | Task | Priority | Checks (requirements §6) |
|--------|---|------|----------|--------------------------|
| Todo | 10 | The leave tables in the database + the five leave types | High | — (enables everything; design §1) |
| Todo | 11 | Rules library: validation, transitions, supervisors, days | High | — (foundation; design §2–3, §6) |
| Todo | 12 | Employee: New request + own list | High | AC-15, AC-16, AC-23 |
| Todo | 13 | Supervisor queue: sign and reject | High | AC-18, AC-19, AC-23 |
| Todo | 14 | Employee: Send the signed request to HR | High | AC-20, AC-23 |
| Todo | 15 | HR queue: approve and reject with remark | High | AC-21, AC-23 |
| Todo | 16 | History views with status and remarks | High | AC-22 |
| Todo | 17 | Server-side enforcement sweep | High | AC-24 (+ re-runs of AC-16/17/18/20) |
| Todo | 18 | Admin view-only table | Medium | AC-25 |
| Todo | 19 | Extra X1 — block duplicate submissions | Low | AC-26 |
| Todo | 20 | Extra X2 — edit before signing | Low | AC-27 |
| Todo | 21 | Extra X3 — HR asks for info | Low | AC-28 |
| Todo | 22 | Extra X4 — submission throttle | Low | AC-29 |
| Todo | 23 | Extra X5 — audit trail + admin audit view | Low | AC-30 |
| Todo | 24 | Extra X6 — seed the sample requests | Low | AC-31 |
| Todo | 25 | Full sweep of the leave acceptance checklist | High | AC-15–AC-31 |

## Task 10 – The leave tables in the database + the five leave types *(High)*

- **Goal:** SQLite has `LeaveType` and `LeaveRequest` exactly as design
  §1, reachable through Prisma, and `npm run db:seed` loads exactly the
  five leave types (Reference C), idempotently, without disturbing the
  six demo users.
- **Files:** extend `prisma/schema.prisma` (the two models + the `User`
  relation fields; `AuditLog` comes with Task 23); extend
  `prisma/seed.ts` — wipe order AuditLog → LeaveRequest → User →
  LeaveType (children before parents), then re-insert users and the five
  types.
- **Check:** `npx prisma db push` succeeds. In `npx prisma studio` the
  two tables show exactly the design §1 fields, with `status` defaulting
  to `Pending supervisor`. `npm run db:seed` twice → exactly five type
  rows and six demo users, no duplicates. `npm run lint` passes.
- **Traces:** design §1, Reference C; brief §7.2 (field tables, leave
  types), §5.2; foundation for U9, U10, U12.

## Task 11 – Rules library *(High, foundation)*

- **Goal:** Before any screen exists, the server can validate a leave
  form, list valid supervisors, compute whole-day durations, and decide
  legal transitions and queue membership.
- **Files:** extend `src/lib/validation.ts` with `validateLeaveForm`;
  create `src/lib/leave-rules.ts` (design §6).
- **Check:** scratch script via `npx tsx` (deleted afterwards):
  10th → 12th next month computes 3 days; end-before-start,
  start-before-today, an unknown type and `Other` without a purpose are
  each refused; `candidateSupervisors(employee-1)` returns exactly
  supervisor-1 and supervisor-2 (both Finance) and excludes hr-1/hr-2
  and admin; each legal move of the design §2 table is accepted and each
  illegal one (skipping `Signed`, deciding a Final row, the owner
  approving) is refused.
- **Traces:** U9, U10, U12, U15 (foundation); design §2–3, §6; brief
  §5.2, §5.3.3, §7.2.

## Task 12 – Employee: New request + own list *(High)*

- **Goal:** `/employee` lists my requests newest-first with badges,
  remarks and timestamps, and the New request card (five types, the
  conditional Other purpose, dates, same-division supervisor dropdown)
  creates a `Pending supervisor` row through a server action, with
  confirmation and success message.
- **Files:** create `src/app/actions/leave.ts` (`submitLeave`:
  requireRole Employee → `validateLeaveForm` → supervisor/division
  check → insert + `revalidatePath`); create
  `src/components/LeaveRequestForm.tsx`, `StatusBadge.tsx`,
  `ConfirmActionButton.tsx`; rewrite `(authed)/employee/page.tsx`.
- **Check:** AC-15, AC-16, AC-23 (submit row).
- **Traces:** U9; AC-15, AC-16, AC-23; design §3 rules 1–2, 8–9, §4, §6;
  brief §5.3.2–3, FR-02, FR-07.

## Task 13 – Supervisor queue: sign and reject *(High)*

- **Goal:** `/supervisor` lists `Pending supervisor` rows naming me;
  Sign (confirm + success) makes it `Signed`; Reject requires a remark
  and makes it `Rejected by supervisor` (Final).
- **Files:** add `signLeave`, `rejectSupervisorLeave` to
  `src/app/actions/leave.ts` (guarded updates per design §2); the
  "For you to sign" and "Handled by you" sections on
  `(authed)/supervisor/page.tsx`.
- **Check:** AC-18, AC-19, AC-23 (sign/reject rows) — including the
  forged posts: the other supervisor, an employee session, and an empty
  remark all refused by the server.
- **Traces:** U10; AC-18–AC-19, AC-23; design §3 rules 3–4, §4–5, §7;
  brief §5.3.4, FR-03, FR-07.

## Task 14 – Employee: Send the signed request to HR *(High)*

- **Goal:** My `Signed` rows show **Send to HR** (and only those do);
  confirm + success; the row becomes `Pending HR` and joins the shared
  HR queue.
- **Files:** add `sendToHrLeave` to `src/app/actions/leave.ts`; the
  button on the employee page via `ConfirmActionButton`.
- **Check:** AC-20 (and AC-23 send row), including the forged send by a
  stranger refused server-side.
- **Traces:** U11; AC-20, AC-23; design §3 rule 5, §4; brief §5.3.5,
  FR-04, FR-07.

## Task 15 – HR queue: approve and reject with remark *(High)*

- **Goal:** `/hr` shows every `Pending HR` row to both hr-1 and hr-2;
  Approve makes `Approved`; Reject needs a remark and makes `Rejected by
  HR`; the deciding officer is recorded; all confirm + success.
- **Files:** add `approveLeave`, `rejectHrLeave` to
  `src/app/actions/leave.ts`; queue content on `(authed)/hr/page.tsx`.
- **Check:** AC-21 and AC-23 (approve/reject rows); a double-decision
  test: two windows approve the same row — one succeeds, the other is a
  no-op (design §2 guard).
- **Traces:** U12; AC-21, AC-23; design §3 rules 3, 6, §4–5; brief
  §5.3.5, FR-05, FR-07.

## Task 16 – History views with status and remarks *(High)*

- **Goal:** FR-06 across all three role pages: current **and** past
  requests — the employee keeps every row ever made with status,
  remarks and timestamps; the supervisor keeps rows they handled
  (including their rejections); HR keeps decisions made.
- **Files:** query and rendering extensions on the three pages.
- **Check:** AC-22.
- **Traces:** U13; AC-22; design §4; brief FR-06.

## Task 17 – Server-side enforcement sweep *(High)*

- **Goal:** Prove FR-10 and the OWASP baseline (§7.5): no bypass from
  the browser. Every mutation action re-checks session, role,
  owner/assignee/officer and status; every page redirects anonymous and
  wrong-role visitors.
- **Files:** none new — harden tasks 12–16 as needed; scratch scripts
  for forged posts, deleted afterwards.
- **Check:** AC-24, plus re-running the forged-post halves of AC-16,
  AC-17, AC-18, AC-20. (Tampered cookies stay covered by login AC-13.)
- **Traces:** U15; AC-24; design §3 rule 9, §7; brief FR-10, §7.5
  (OWASP Top 10).

## Task 18 – Admin view-only table *(Medium)*

- **Goal:** FR-08 / §5.3.6: admin sees every record — requester,
  division, type, dates, status, remarks, deciding officer — with no
  buttons anywhere.
- **Files:** rewrite `(authed)/admin/page.tsx` (query view only; filters
  for status/type/division via query params).
- **Check:** AC-25.
- **Traces:** U16; AC-25; design §4–5, §7; brief FR-08, §5.3.6.

## Task 19 – Extra X1: block duplicate submissions *(Low)*

- **Goal:** While the owner holds an open row (`Pending supervisor`,
  `Signed` or `Pending HR`), `submitLeave` refuses a new one, naming the
  blocker. *(Not a brief rule — the interview's D4, Low per §1.2/FR-09.)*
- **Files:** X1 branch in `submitLeave` through `leave-rules`.
- **Check:** AC-26.
- **Traces:** U17 (X1); AC-26; design §3 rule 11.

## Task 20 – Extra X2: edit before signing *(Low)*

- **Goal:** The owner edits their own `Pending supervisor` row (type,
  purpose, dates, supervisor) with confirm + success; no edit path for
  `Signed` or Final rows, server-enforced.
- **Files:** `editLeave` in `src/app/actions/leave.ts`; edit UI reusing
  `LeaveRequestForm`.
- **Check:** AC-27.
- **Traces:** U18 (X2); AC-27; design §3 rule 11.

## Task 21 – Extra X3: HR asks for info *(Low)*

- **Goal:** HR adds a mandatory note to a `Pending HR` row; the row
  stays queued; the note shows on the owner's list.
- **Files:** `askInfoLeave`; `infoNote`/`infoNoteAt` columns on
  `LeaveRequest` + `db push`; note rendering on the employee page.
- **Check:** AC-28.
- **Traces:** U19 (X3); AC-28; design §3 rule 11.

## Task 22 – Extra X4: submission throttle *(Low)*

- **Goal:** Cap submissions per user per rolling hour (default 10,
  `SUBMIT_LIMIT_PER_HOUR` dev override), in-memory like the login
  lockout; the over-cap submit gets a try-again-later message.
- **Files:** create `src/lib/action-throttle.ts`; wire into
  `submitLeave`.
- **Check:** AC-29, including a second user unaffected and the counter
  clearing on dev restart.
- **Traces:** U20 (X4); AC-29; design §3 rule 11, §6.

## Task 23 – Extra X5: audit trail + admin audit view *(Low)*

- **Goal:** Every leave action writes one `AuditLog` row (user, action,
  request id, detail, timestamp) in the same transaction; the admin
  page gains a newest-first audit section.
- **Files:** `AuditLog` model + `db push`; `src/lib/audit.ts`;
  `recordAction` calls inside every action; the admin section.
- **Check:** AC-30.
- **Traces:** U21 (X5); AC-30; design §1, §3 rule 11.

## Task 24 – Extra X6: seed the sample requests *(Low)*

- **Goal:** `prisma/seed.ts` also loads the Reference D rows — all six
  statuses, employee-1 only, relative future dates, idempotently.
- **Files:** extend `prisma/seed.ts`.
- **Check:** AC-31 (run twice, compare against design Reference D).
- **Traces:** U22 (X6); AC-31; design §1 (seed note), Reference D.

## Task 25 – Full sweep of the leave acceptance checklist *(High)*

- **Goal:** The module is done and provably matches the specs: every row
  of `01-requirements.md` leave §6 has been walked by hand on the demo
  accounts.
- **Files:** none new. Fix (or spec-fix first, then fix) anything the
  sweep finds.
- **Check:** run AC-15 → AC-31 in order with the demo accounts (extras
  that were skipped are ticked N/A, their tasks stay Todo), ticking each
  row's Status; `npm run lint` and `npm run build` pass clean.
- **Traces:** U9–U22 and AC-15–AC-31; brief §8 step 6 (Check).
