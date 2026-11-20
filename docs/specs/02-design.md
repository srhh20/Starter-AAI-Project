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
| `/` | Anyone | Server-side redirect only: signed in → own home; anonymous → `/login` | Done |
| `/login` | Anonymous | Email + password form, "Sign in" button, generic error text, format hint, lockout notice, "You have been signed out" banner after sign-out. Signed-in visitors are redirected to their home. Styled per §8 | Done |
| `/employee` | Employee | Login-stage placeholder: header with name + role + Sign out, and a "Your leave requests will appear here" panel. Styled per §8 | Done |
| `/supervisor` | Supervisor | Same placeholder shell, worded for the signature queue. Styled per §8 | Done |
| `/hr` | HR | Same placeholder shell, worded for the Pending-HR queue. Styled per §8 | Done |
| `/admin` | Admin | Same placeholder shell, worded for the all-records view. Styled per §8 | Done |

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

## 8. Look and feel (visual design)

> Reference: the "Member login" mockup supplied on 2026-11-20 (blurred blue
> sky). This section is **cosmetic only**: nothing in §2 (rules) or §4
> (behaviour) changes — same text, fields, messages, confirmations,
> redirects and cookie behaviour.

- **Background.** Every screen sits on a blurred sky-blue gradient
  (top `#5b82bd` → `#a9c4e8` → bottom `#dce9f7`, with soft white cloud
  washes). The reference's stock photo is licensed imagery, so the look is
  rebuilt with CSS gradients — no image file is added to the repo.
- **Palette.** Slate blue `#4a6184` (icon boxes, buttons, header bar, card
  headings; hover `#3e5375`); white fields and cards; gray
  placeholder/secondary text; white text on blue surfaces.
- **Login screen.** One centred column (max 384 px) directly on the
  gradient — no card. A light-weight white title (wide letter spacing,
  app name rather than the mockup's "MEMBER LOGIN" wording) with a small
  people icon beneath, a subtitle, then the form. Each field is one row: a
  square slate-blue icon box (person / lock glyph in white) flush against a
  white input with gray placeholder; rows stack with ~24 px gaps. The
  submit button spans the field column: slate-blue, white uppercase
  wide-tracked text. Error messages render in semibold red (`red-600`,
  readable where the gradient lightens); the signed-out banner is white
  text on a translucent white chip. Visible labels become
  screen-reader-only text in the markup so fields stay accessible and
  testable. The mockup's "Remember
  me" and "Forgot password?" are deliberately **not** built (requirements
  §5) — decision confirmed 2026-11-20.
- **Role homes.** Same gradient behind everything; a solid slate-blue
  header bar carries the brand on the left and `Name · Role` plus a
  ghost-white uppercase Sign out button on the right. Each page's content
  is one white card with a soft shadow: slate-blue heading, slate-gray
  body text.

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

---

# Leave Request – Design

> **This file answers:** How is the leave module put together? (data,
> rules, screens, where the code lives)
> **Who:** The AI drafts it. You review all of it.
>
> If this file and the requirements disagree, fix the requirements first,
> then this file.

Designs the leave module matching `01-requirements.md` (U9–U22,
AC-15–AC-31) and brief §5.1, §5.2, §5.3, §6, §7.2. The login design above
is unchanged; this section adds to it.

**Audit note (2026-11-20).** Replaces an earlier draft written from a
faulty text extraction. The brief's real model: six statuses (§5.2 — no
`Cancelled`), five leave types with a mandatory "Other" purpose (§7.2),
no employee reason field, the employee picks a supervisor from their own
division (§5.3.3), only Employees apply (§5.3.2), the employee presses
Send after signing (FR-04), and every action confirms then reports
success (FR-07). §7.5 mandates exactly one security baseline — the OWASP
Top 10 (2025) — and nothing more; the earlier "7.5.x" numbered-rule
citations do not exist in the document and are removed. Interview answers
beyond the brief are the Low-priority extras **X1–X6** (rules 11).

## 1. Tables

Three new tables. `User` gains only Prisma relation fields — no stored
data changes.

### `LeaveType` — the five fixed dropdown options (§7.2)

| Field | Type | Required? | What it holds |
|-------|------|-----------|---------------|
| `id` | number | auto | Unique number for the row |
| `name` | text | yes | Exactly `Annual leave`, `Maternity leave`, `Unpaid leave`, `Compassionate leave`, `Other`, unique. Loaded by the seed; the app never edits it |
| `description` | text | no | Optional helper line shown under the dropdown (from the §7.2 Notes column) |

### `LeaveRequest` — one row per request (the §7.2 field table)

| Field | Type | Required? | What it holds |
|-------|------|-----------|---------------|
| `id` | number | auto | Row number, quoted by the audit log (X5) |
| `employeeId` | number | yes | The owner — FK to User. The server enforces role `Employee` (§5.3.2) |
| `supervisorId` | number | yes | The chosen signer — FK to User. Server check: role `Supervisor` **and** the same division as the owner (§5.3.3) |
| `leaveTypeId` | number | yes | FK to LeaveType — one of the five |
| `otherLeaveType` | text | when type is Other | "What the leave is for" — required ≤500 when type is `Other`, else null (§7.2, A2) |
| `startDate` | date | yes | Today or later (A1); stored as midnight UTC |
| `endDate` | date | yes | On/after the start (§7.2). Duration = days between + 1, **computed, never stored** |
| `status` | text | yes | Exactly one of the six §5.2 strings: `Pending supervisor`, `Signed`, `Pending HR`, `Approved`, `Rejected by supervisor`, `Rejected by HR`; the code rejects anything else (SQLite has no enum). Default `Pending supervisor` |
| `supervisorRemark` | text | when rejected by supervisor | The supervisor's reason — required on reject (§7.2) |
| `hrOfficerId` | number | when decided | The HR user who decided — FK to User; set when approved or rejected (FR-05, §7.2) |
| `hrRemark` | text | when rejected by HR | Required on HR reject (FR-05, §7.2) |
| `submittedAt` | date | auto | Set on submit |
| `signedAt` | date | auto | Set when the supervisor signs |
| `sentToHrAt` | date | auto | Set when the employee presses Send (records the FR-04 step — spec decision) |
| `decidedAt` | date | auto | Set on approve/reject |

(§7.2 lists "Dates: submitted, signed and decided" as auto-set;
`sentToHrAt` is the one addition, so the FR-04 step is visible.)

### `AuditLog` — Low-priority extra X5 (U21)

| Field | Type | Required? | What it holds |
|-------|------|-----------|---------------|
| `id` | number | auto | Unique number for the row |
| `userId` | number | yes | Who did it — FK to User |
| `action` | text | yes | One of the fixed actions in Reference C |
| `entity` | text | yes | `LeaveRequest` |
| `entityId` | number | yes | The request's id |
| `detail` | text | no | Short extra text (e.g. the reject remark) |
| `createdAt` | date | auto | When — newest first on the admin page |

Append-only: no page or action ever updates or deletes these rows.

## 2. Statuses and transitions

The six §5.2 statuses, verbatim, with meanings in requirements §2. Only
these moves exist, each re-checked by the server immediately before it
writes:

| Move | Who | Server requires |
|------|-----|-----------------|
| (new) → `Pending supervisor` | Owner (role Employee) | Validated form; chosen supervisor is a same-division Supervisor |
| `Pending supervisor` → `Signed` | The named supervisor only | Row still `Pending supervisor`; sets `signedAt` |
| `Pending supervisor` → `Rejected by supervisor` | The named supervisor only | Remark mandatory; sets `supervisorRemark` |
| `Signed` → `Pending HR` | The owner only | Row still `Signed`; sets `sentToHrAt` |
| `Pending HR` → `Approved` | Either HR account | Row still `Pending HR`; sets `hrOfficerId`, `decidedAt` |
| `Pending HR` → `Rejected by HR` | Either HR account | Remark mandatory; sets `hrOfficerId`, `hrRemark`, `decidedAt` |

`Approved`, `Rejected by supervisor` and `Rejected by HR` are **Final**:
no action, no button and no server path leads out of them (§5.2). Every
move is written as a **guarded update** — update … where `id = ?` and
`status = <expected>` — so two people acting at once (both HR officers
approving) cannot double-decide; the loser's click becomes a no-op.

## 3. Business rules

1. **Only the Employee role submits** (§5.3.2). `submitLeave` refuses
   other roles. The supervisor dropdown offers only `Supervisor`s of the
   owner's division, and the server re-checks `supervisorId` against
   that rule (§5.3.3, FR-02).
2. **Server validates the form** (FR-10): dates parse; end ≥ start
   (§7.2); start ≥ today (A1); type is one of the five; `Other`
   requires its purpose ≤500 (§7.2, A2); remarks mandatory where §7.2
   says so, capped at 500 (A2).
3. **Transitions are exactly §2**; anything else — including forged
   posts with valid sessions — is refused.
4. **Sign** (FR-03): the named supervisor only; signing carries no
   remark. **Reject** (FR-03): the named supervisor only; remark
   mandatory → `Rejected by supervisor`, which never reaches the HR
   queue.
5. **Send to HR** (FR-04, §5.3.5): the owner only, only from `Signed`;
   the row enters the shared queue both HR accounts read.
6. **HR decisions** (FR-05, §5.3.5): either hr-1 or hr-2 may decide any
   `Pending HR` row; approve → `Approved`; reject → remark mandatory →
   `Rejected by HR`; `hrOfficerId` records who did it.
7. **Admin changes nothing** (§5.3.6, FR-08): no admin mutation action
   exists in the code at all.
8. **Every write action: confirm, then succeed** (FR-07, §5.3.7):
   a client-side confirm like the login `SignOutButton`, and a success
   message shown via a `?msg=` banner when the action returns.
9. **Nothing trusted from the browser:** every action runs
   `requireUser()` → `requireRole()` → re-reads the row from the
   database → checks owner/assignee/officer → checks the transition
   (FR-10; OWASP A01/A03). Hidden buttons are presentation, never
   enforcement.
10. **Messages leak nothing** about other people's data; errors name
    only the actor's own requests, generic responses for foreign ids.
11. **Low-priority extras (X1–X6) are independent add-ons** — unbuilt,
    nothing above changes: X1 `submitLeave` also refuses while the owner
    holds any open row; X2 adds `editLeave` (owner, `Pending supervisor`
    only); X3 adds `infoNote`/`infoNoteAt` columns plus an HR note
    button; X4 caps submissions per user per rolling hour (in-memory,
    the `login-throttle.ts` pattern, dev override
    `SUBMIT_LIMIT_PER_HOUR`); X5 writes one `AuditLog` row per action in
    the same transaction; X6 seeds the Reference D rows.

## 4. Screens (routes)

The four home pages that login shipped as placeholders get real content;
this table replaces the four `(authed)` rows of login §4 as the tasks
land.

| Route | Who | Leave content |
|-------|-----|---------------|
| `/employee` | Employee | **My requests**, newest first: type (with purpose if Other), dates + computed days, status badge, remarks, timestamps (who signed/sent/decided, when). A **Send to HR** button on `Signed` rows only. **New request** card: type dropdown (five; a purpose textarea appears when `Other` is picked), start, end, supervisor dropdown (same-division only). Every button confirms first, then shows a success message (FR-07) |
| `/supervisor` | Supervisor | **For you to sign**: `Pending supervisor` rows where `supervisorId` = me — requester name, type, dates, days. Buttons: Sign (confirm) and Reject (remark mandatory). Below: **Handled by you** — past requests with status and your remark (FR-06) |
| `/hr` | HR | **Queue**: every `Pending HR` row, shared by hr-1 and hr-2 — requester, type, dates, days, signing supervisor. Buttons: Approve / Reject (remark mandatory), each confirm + success; the decider is recorded. Below: **Your decisions** history |
| `/admin` | Admin | **All records**, read-only table: requester, division, type, dates, days, status, remarks, deciding officer. No buttons anywhere. X5 adds an audit-log section below it |

Badges: `Pending supervisor` and `Pending HR` amber, `Signed` blue,
`Approved` green, `Rejected by supervisor`/`Rejected by HR` red. Visual
language follows login §8.

## 5. Who can do what

| Action | Employee | Supervisor | HR | Admin |
|--------|----------|------------|----|-------|
| Submit a request | own only | — (§5.3.2) | — (§5.3.2) | — (§5.3.2) |
| Choose the signing supervisor (same division) | ✔ | — | — | — |
| Sign / reject | — | ✔ only rows naming them | — | — |
| Send to HR | ✔ own `Signed` rows | — | — | — |
| Approve / reject | — | — | ✔ any `Pending HR` row | — |
| See current + past requests, statuses, remarks | own | assigned to them | their decisions' scope + queue | all |
| See every record | — | — | — | ✔ (§5.3.6) |
| Any other change to a row | — | — | — | ✖ never |

## 6. Where the code lives (new and changed)

| File | What's in it |
|------|--------------|
| `prisma/schema.prisma` | `LeaveType`, `LeaveRequest` (+ `AuditLog` in X5's Task 23) and the `User` relation fields (§1) |
| `prisma/seed.ts` | The six demo users stay exactly as they are; adds the five leave types. Wipe order: AuditLog → LeaveRequest → User → LeaveType — children before parents (FK-safe, keeps the login wipe working). X6 (Task 24) adds the Reference D rows with relative future dates |
| `src/lib/validation.ts` | Extended: `validateLeaveForm` — date rules (A1, §7.2), type ∈ five, `Other` purpose, remark rules (A2) |
| `src/lib/leave-rules.ts` | The §2 transition table, allowed action per role/status, `candidateSupervisors(user)` (role Supervisor, same division), `days(start,end)` |
| `src/lib/action-throttle.ts` | X4: generic in-memory per-user counter (the `login-throttle.ts` pattern) |
| `src/lib/audit.ts` | X5: `recordAction(userId, action, entityId, detail?)` |
| `src/app/actions/leave.ts` | Server actions: `submitLeave`, `signLeave`, `rejectSupervisorLeave`, `sendToHrLeave`, `approveLeave`, `rejectHrLeave` (+ `editLeave` in X2, `askInfoLeave` in X3). Each: `requireRole` → re-read row + owner/assignee/officer check → `leave-rules` → guarded Prisma update → `revalidatePath`; success message via `?msg=` redirect (FR-07) |
| `src/components/LeaveRequestForm.tsx` | New-request client form (`useActionState`, inline errors, conditional Other-purpose textarea, supervisor dropdown) |
| `src/components/ConfirmActionButton.tsx` | Confirm → server action → success param — the FR-07 pattern, modelled on login's `SignOutButton` |
| `src/components/StatusBadge.tsx` | One badge per §5.2 status |
| `src/app/(authed)/{employee,supervisor,hr,admin}/page.tsx` | Rewritten with the §4 content; each still starts with its `requireRole` |

No new packages, and no new commands beyond login §7 (`db push`,
`db:seed`, `dev`, `lint` cover everything).

## 7. Security (leave-specific)

- **Role + object-level checks in every action** (OWASP A01, FR-10):
  Employee role to submit; only the named supervisor signs/rejects; only
  the owner sends; either HR officer decides; Admin has no mutation
  action to reach.
- **Input validated server-side before any write** (A03): made-up ids,
  types, statuses or dates are refused before touching the database.
- **SQL injection:** Prisma only, parameterised. **XSS:** purposes and
  remarks render through React escaping only. **CSRF:** the sameSite=lax
  session cookie plus server actions, exactly as login (§6).
- **Guarded status updates** stop double decisions (§2).
- **§7.5 = the OWASP Top 10 (2025) baseline for the whole system**; the
  brief lists no further numbered rules — anything beyond the baseline
  here is a spec decision (A1–A3) or a Low extra (X1–X6), not a brief
  mandate.
- Success/error text speaks only about the actor's own data.

## Reference C. Fixed lists (leave)

- **Statuses (six, §5.2):** `Pending supervisor`, `Signed`,
  `Pending HR`, `Approved`, `Rejected by supervisor`, `Rejected by HR`
- **Leave types (five, §7.2):** `Annual leave`, `Maternity leave`,
  `Unpaid leave`, `Compassionate leave`, `Other`
- **Audit actions (X5):** `submit`, `sign`, `reject_supervisor`,
  `send_to_hr`, `approve`, `reject_hr` (+ `edit` with X2, `ask_info`
  with X3)

## Reference D. Sample requests (X6 — Low priority, `npm run db:seed`)

Every row belongs to employee-1 (the only possible applicant, §5.3.2),
with dates relative to the seed day so they never go stale, covering all
six statuses:

| Type | Chosen supervisor | End state | Detail |
|------|-------------------|-----------|--------|
| Annual leave | supervisor-1 | `Pending supervisor` | untouched — supervisor-1's queue demo |
| Compassionate leave | supervisor-2 | `Pending supervisor` | a second open row (allowed while X1 is unbuilt) |
| Unpaid leave | supervisor-2 | `Signed` | signed by supervisor-2 — the Send-to-HR demo |
| Annual leave | supervisor-1 | `Pending HR` | signed and sent — the shared HR queue demo |
| Maternity leave | supervisor-1 | `Approved` | decided by hr-2 |
| Other ("attending a family wedding") | supervisor-1 | `Rejected by supervisor` | remark set |
| Annual leave | supervisor-2 | `Rejected by HR` | signed, sent, rejected by hr-1 with a remark |

If X1 (duplicate block) is later built, employee-1's seeded open rows
will block new submissions — acceptable for the demo; noted in the seed
comment.
