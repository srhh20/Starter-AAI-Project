# Login – Requirements

> **This file answers:** What should the app do, and why?
> **Who:** The AI drafts it from your interview. You review it.
>
> When the app's behaviour needs to change, update this file **first**.

Covers login only (FR-01, FR-10 of the brief, section 7.2 demo users). The
leave-request flow, supervisor signing, HR decisions and the admin view are
specified later.

## 1. The problem

Budiman Company's leave process is moving from paper to a web system, and
about 200 staff share one system. Without login, anyone could open anyone's
requests and decisions could be made by people who have no authority. Staff
also work on shared laptops, so sessions must end cleanly.

This module provides:

1. One way in: sign in with the work email (@budiman.com) and a password.
2. One home page per role, and no way for a role to open another role's pages.
3. A safe session: signed cookie, 8-hour expiry, tamper-proof, role checked
   against the database on every request.
4. A clean way out: sign out with a confirmation, then a success message.
5. Protection against password guessing: generic errors and a lockout.
6. The same demo users for every developer, loaded by a seed script.

## 2. Who uses it (roles)

| Role | Home page | What they do |
|------|-----------|--------------|
| **Employee** | `/employee` | Signs in, lands on their own list, signs out. Leave actions come in the next spec. |
| **Supervisor** | `/supervisor` | Signs in, lands on the requests awaiting their signature, signs out. |
| **HR** | `/hr` | Signs in, lands on the shared Pending-HR queue, signs out. |
| **Admin** | `/admin` | Signs in, lands on the all-records view, signs out. |

Every role has exactly one role, set by the seed data. There is no sign-up
page: the Users table is the only source of accounts.

## 3. User stories

- **U1. Sign in** *(High)*. As a staff member, I can sign in with my
  @budiman.com email and my password so that I reach my role's home page.
- **U2. Role separation** *(High)*. As the company, I can rely on every page
  and action checking my role against the database so that no role can open
  another role's pages (FR-01, OWASP A01).
- **U3. Safe failures** *(High)*. As the company, I want failed logins to
  reveal nothing and five wrong attempts to lock the email for 15 minutes so
  that passwords cannot be guessed (OWASP A07).
- **U4. Signed, expiring sessions** *(High)*. As the company, I want the
  session cookie signed, carrying only the user id, expiring 8 hours after
  login, and stored httpOnly so that a stolen or edited cookie cannot be used.
- **U5. Sign out** *(High)*. As a signed-in user, I can sign out from a
  header button after confirming, so that the next person on this laptop
  cannot act as me, with a success message on the login page.
- **U6. Seed the demo users** *(High)*. As a developer, I can load the six
  demo users from section 7.2 of the brief with one command so that everyone
  tests with the same accounts and bcrypt-hashed passwords.
- **U7. Email format hint** *(Medium)*. As a user, I get told to use my
  Budiman work email when I type an address outside @budiman.com so that I
  know what to fix, without learning whether any account exists.
- **U8. No double login** *(Medium)*. As a signed-in user, I am bounced to my
  own home page when I open `/` or `/login` so that I never sit on a login
  form I no longer need.

## 4. Acceptance checklist

Test by hand in a browser. Demo accounts (brief section 7.2), all with
password `password123`: employee-1@budiman.com (Employee),
supervisor-1@budiman.com (Supervisor), hr-1@budiman.com (HR),
admin@budiman.com (Admin).

| Status | ID | Check | How to test |
|--------|----|-------|-------------|
| Done | AC-01 | Each role signs in and lands on its own home page | • Open `/login`<br>• Sign in as employee-1@budiman.com / `password123`<br>• You should land on `/employee`<br>• Repeat for supervisor-1 → `/supervisor`, hr-1 → `/hr`, admin → `/admin` |
| Done | AC-02 | A wrong password gives the generic error, nothing more | • Open `/login`<br>• Enter employee-1@budiman.com and a wrong password<br>• You should see "Invalid email or password" — no hint about which field was wrong, and you stay on `/login` |
| Done | AC-03 | An unknown email gives the identical generic error | • Open `/login`<br>• Enter nobody@budiman.com / `password123`<br>• The message and timing feel the same as AC-02; no "no such account" text anywhere |
| Done | AC-04 | Emails outside @budiman.com are rejected as bad format | • Open `/login`<br>• Enter alice@gmail.com / `password123`<br>• You should be asked to use your Budiman work email; no database check is described to you |
| Done | AC-05 | Login is case-insensitive on the email | • Open `/login`<br>• Enter EMPLOYEE-1@BUDIMAN.COM / `password123`<br>• You should land on `/employee` |
| Done | AC-06 | Five failures lock that email for 15 minutes | • Open `/login`<br>• Enter employee-1@budiman.com with a wrong password 5 times<br>• On the 6th attempt you should see a "too many attempts, try again later" message<br>• Enter the *correct* password — still refused while locked<br>• Sign in as hr-1 — not affected (lock is per email) |
| Done | AC-07 | A role cannot open another role's pages | • Sign in as employee-1<br>• Type `/admin` in the address bar<br>• You should be silently bounced to `/employee`<br>• Repeat from `/employee` for `/supervisor` and `/hr` as a different role |
| Done | AC-08 | Protected pages require a session | • Sign out (or use a private window)<br>• Open `/employee`, `/supervisor`, `/hr`, `/admin` directly<br>• Each should redirect to `/login` |
| Done | AC-09 | Signed-in users never see the login form | • Sign in as hr-1<br>• Open `/login` and `/`<br>• Each should redirect to `/hr` |
| Done | AC-10 | Sign out needs a confirmation and reports success | • Sign in as admin<br>• Click "Sign out" in the header<br>• Confirm the "Are you sure…" prompt — a wrong click on Cancel should keep you signed in<br>• After confirming you should be on `/login` with a "You have been signed out" message<br>• Press the browser Back button — you should be bounced back to `/login`, not into `/admin` |
| Done | AC-11 | Sessions expire 8 hours after login | • For this test only, set the session lifetime to 60 seconds via a dev setting (e.g. `SESSION_MAX_AGE_SECONDS=60`)<br>• Sign in as employee-1, wait past the expiry, open `/employee`<br>• You should be redirected to `/login` |
| Done | AC-12 | The session cookie is httpOnly, SameSite=Lax, path=/, and Secure on HTTPS | • Sign in, open browser DevTools → Application → Cookies<br>• The session cookie should show `HttpOnly`, `SameSite=Lax`, `Path=/`<br>• `Secure` is set whenever the site is served over HTTPS (absent on `http://localhost` is fine) |
| Done | AC-13 | A tampered cookie is rejected | • Sign in as employee-1<br>• In DevTools, change the user id inside the cookie value (or copy it to another browser and edit it)<br>• Open `/employee`<br>• Signature verification should fail and you should be sent to `/login` — never a database error |
| Done | AC-14 | The seed script loads exactly the six demo users, hashed | • Run `prisma db seed`<br>• Open the SQLite database and check the Users table: six rows matching section 7.2 (emails, names, IC numbers, roles, divisions, designations)<br>• Each password starts with `$2` (bcrypt), not plain `password123`<br>• Run the seed again and re-check: still six rows, no duplicates<br>• All six accounts sign in with `password123` |

## 5. Not included (for now)

- The leave request flow itself — submission, supervisor signing, HR decisions,
  admin view (their own specs, next).
- Sign-up, password change, password reset, forgotten passwords.
- Multi-factor authentication and any "remember me" option beyond the 8-hour
  session.
- Admin screens to create, edit or deactivate users.
- Per-account lockout settings, IP-based throttling, audit logs.
- Any password rules at login time — `password123` for all demo users is a
  deliberate brief-mandated exception for this demo.

---

# Leave Request – Requirements

> **This file answers:** What should the app do, and why?
> **Who:** The AI drafts it from the brief and your interview. You review it.
>
> When the app's behaviour needs to change, update this file **first**.

Covers the leave-request module: brief §4 (roles), §5.1 (workflow), §5.2
(statuses), §5.3 (business rules), §6 (FR-02–FR-08) and §7.2 (the
leave-request fields). Story and check numbers continue from login: U9+
and AC-15+.

**Audit note (2026-11-20).** This section replaces an earlier draft. That
draft was drafted from a faulty text extraction of the PDF which
misquoted the brief (four statuses including "Cancelled", four leave
types, an employee "reason" field, duplicate-block, and rule citations
"7.1.1–7.1.3", "7.4.2", "7.5.1–7.5.8" that do not exist in the document).
This version follows the actual document, verified page-by-page against
the rendered PDF: six statuses (§5.2), five leave types (§7.2), no
cancel/withdraw, the employee chooses a supervisor from their own
division (§5.3.3), only Employees apply (§5.3.2), and the employee sends
the signed request to HR (§5.3.5). Interview answers that contradicted
the fixed brief are **overridden**; interview answers adding what the
brief does not contain became **Low-priority extras (X1–X6)** per §1.2
("Extra ideas are Low priority") and FR-09.

## 1. The problem

The paper process (§2): a form is filled in, handed to the supervisor,
signed, and re-typed into a spreadsheet. Forms get lost, employees cannot
see where their request is, and HR has no single list of requests waiting
for a decision. This module delivers the §3 goals: one system visible
from submission to decision, each person sees only what they must act on,
and nothing gets lost.

It provides:

1. A request form with exactly the §7.2 fields: leave type (with a
   mandatory "what it is for" when **Other**), start date, end date, and
   a supervisor chosen from the employee's division.
2. The six fixed §5.2 statuses and the §5.1 flow: supervisor first, then
   the employee sends the signed request to the shared HR queue.
3. Supervisor sign/reject and HR approve/reject, each rejection with a
   mandatory remark; the deciding HR officer is recorded (FR-03, FR-05).
4. Confirmation before every action and a success message after (§5.3.7).
5. Every role sees its current and past requests with status and remarks
   (FR-06); Admin sees every record, view only (FR-08).
6. Rules enforced on the server: roles, transitions and field checks
   (FR-10; the §7.5 baseline is the OWASP Top 10, 2025).

## 2. The fixed flow (§5.1–§5.2 — statuses are exactly the brief's)

| Status | Meaning (§5.2, verbatim) |
|--------|-------------------------|
| `Pending supervisor` | Submitted. Waiting for the supervisor |
| `Signed` | The supervisor signed it. The employee can now send it to HR |
| `Pending HR` | Sent to HR. Waiting for a decision |
| `Approved` | HR approved it. Final |
| `Rejected by supervisor` | The supervisor rejected it, with a reason. Final |
| `Rejected by HR` | HR rejected it, with a reason. Final |

Only these transitions exist:

| From | To | Who / what it requires |
|------|----|------------------------|
| (new) | `Pending supervisor` | The employee submits (FR-02) |
| `Pending supervisor` | `Signed` | The named supervisor signs (FR-03) |
| `Pending supervisor` | `Rejected by supervisor` | The named supervisor rejects — reason mandatory (FR-03). **Final** |
| `Signed` | `Pending HR` | The employee sends their own request (FR-04) |
| `Pending HR` | `Approved` | Either HR officer approves (FR-05). **Final** |
| `Pending HR` | `Rejected by HR` | Either HR officer rejects — remark mandatory, officer recorded (FR-05). **Final** |

There is **no cancel/withdraw status** — the brief defines none (an
earlier draft of this spec had one, from the bad extraction; it is
withdrawn). After a Final Rejected, the only way forward is a brand-new
request; decided rows never change (this is the interview's resubmit
answer, D10, read against the true statuses).

## 3. Who applies and who decides (§5.3)

- **Only the Employee role submits.** Supervisors and HR only decide;
  they never apply (§5.3.2). Admin changes nothing (§5.3.6).
- The employee **chooses a supervisor from their own division**
  (§5.3.3). That supervisor — and only that supervisor — signs or
  rejects (FR-03). Demo data puts both supervisors in Finance with
  employee-1, so the dropdown offers exactly supervisor-1 and
  supervisor-2.
- After signing, **the employee sends** the request to the shared HR
  queue; either HR officer may decide, and the system records who did
  (§5.3.5, FR-04, FR-05).
- **Every action asks for confirmation first and shows a success
  message afterwards** (§5.3.7, FR-07) — the same pattern as Sign out
  (AC-10).

## 4. Leave types and dates (§7.2)

- Exactly five types: **Annual leave, Maternity leave, Unpaid leave,
  Compassionate leave, Other**. When **Other** is chosen, the employee
  must write what the leave is for (§7.2 "Other leave type" — "Only when
  the type is Other. Required then").
- End date is not before start date (§7.2). Requests are whole calendar
  days; duration is computed from the range and never entered (the brief
  has no duration field).
- The brief has **no free-text employee "reason" field** — remarks exist
  only as the supervisor's or HR's rejection reasons.

Spec rules the brief does not fix (assumptions — flagged for your
review):

- **A1:** the start date must be today or later.
- **A2:** every free-text field (other-leave text, supervisor remark,
  HR remark) is capped at 500 characters.
- **A3:** weekends and public holidays count as ordinary days — the
  brief has no holiday calendar.

## 5. User stories

Priorities mirror the §6 FR table. The extras (X#) are **Low** per §1.2
and FR-09 — build them only after High and Medium are done.

- **U9. Submit a request** *(High)*. As an employee, I pick a type (+
  purpose when Other), start and end dates, and a supervisor from my own
  division; I confirm, submit, get a success message, and my request
  waits as `Pending supervisor`. (FR-02; tests: AC-15, AC-16, AC-17)
- **U10. Supervisor signs or rejects** *(High)*. As a supervisor, I see
  the requests sent to me; signing makes it `Signed`; rejecting needs a
  remark and makes it `Rejected by supervisor` — final, and never seen
  by HR. (FR-03; tests: AC-18, AC-19)
- **U11. Send to HR** *(High)*. As the employee, once my request is
  signed I send it to the shared HR queue, with confirmation and a
  success message. (FR-04; test: AC-20)
- **U12. HR decides** *(High)*. As an HR officer, I see the shared
  `Pending HR` queue; approve makes `Approved`, reject needs a remark
  and makes `Rejected by HR`; either officer can handle any request and
  the decider is recorded. (FR-05; test: AC-21)
- **U13. Everyone sees their requests** *(High)*. As each role, I see
  my current and past requests with the status and remarks — my list is
  the tracker. (FR-06; test: AC-22)
- **U14. Confirm then succeed** *(High)*. As any user, every write
  action — submit, sign, reject, send, approve — asks for confirmation
  first and shows a success message after; cancelling changes nothing.
  (FR-07, §5.3.7; test: AC-23)
- **U15. Server-side safety** *(High)*. As the company, every page and
  action re-checks login, role, ownership (own request / assigned queue
  / HR officer), field rules and the legal transition, so the OWASP Top
  10 baseline (§7.5) cannot be bypassed from the browser. (FR-10;
  tests: AC-16, AC-17, AC-18, AC-20, AC-24)
- **U16. Admin view-only** *(Medium)*. As Admin, I see every leave
  record with its statuses and remarks and no buttons. (FR-08, §5.3.6;
  test: AC-25)

Low-priority extras — interview answers the brief does not contain
(spec-first per FR-09, Low per §1.2; skipping one changes nothing else):

- **U17. Block duplicate submissions** *(Low, X1 — interview D4)*. While
  I hold an open (still in flow: `Pending supervisor`, `Signed` or
  `Pending HR`) request, a new submission is blocked. (AC-26)
- **U18. Edit before signing** *(Low, X2 — interview D10)*. I can edit
  my own `Pending supervisor` request (type, purpose, dates, supervisor);
  once `Signed`, it is locked. (AC-27)
- **U19. HR asks for info** *(Low, X3 — interview D7)*. HR adds a note
  to a `Pending HR` request (stays `Pending HR`); the employee sees the
  note in their list. (AC-28)
- **U20. Submission throttle** *(Low, X4 — interview D12)*. A user is
  capped at 10 submissions per rolling hour, reusing the login-lockout
  pattern. (AC-29)
- **U21. Audit trail** *(Low, X5 — interview D8)*. Every leave action
  writes (user, action, request, timestamp) to an AuditLog, shown to
  Admin. (AC-30)
- **U22. Seed sample requests** *(Low, X6 — interview D13)*.
  `npm run db:seed` also loads demo requests covering all six statuses.
  (AC-31)

## 6. Acceptance checklist

Accounts as in login (Reference B: employee-1, supervisor-1, supervisor-2,
hr-1, hr-2, admin; all `password123`). Employee-1 and both supervisors
are in Finance. Extra ACs (marked) are tested only after their Low task
is built.

| Status | ID | Check | How to test |
|--------|----|-------|-------------|
| | AC-15 | Submit with a chosen supervisor | • Sign in as employee-1 → `/employee`<br>• New request: "Annual leave", tomorrow → +3 days; the supervisor dropdown offers supervisor-1 and supervisor-2 only (no HR, no admin)<br>• Press Submit → a confirm prompt appears → OK → a success message shows → the row reads `Pending supervisor` |
| | AC-16 | Server rejects bad input | • End date before start → error, no row created<br>• **Other** with no purpose → error; with a purpose → accepted<br>• A made-up type value (DevTools) → refused server-side<br>• `supervisorId` set to hr-1 → refused server-side (not a Supervisor of this division) |
| | AC-17 | Only employees apply (§5.3.2) | • Sign in as supervisor-1, hr-1, admin in turn → no "New request" form anywhere<br>• A scratch script posting `submitLeave` as supervisor-1 → refused by the server |
| | AC-18 | Only the chosen supervisor acts | • employee-1 files choosing supervisor-1 → it appears on supervisor-1's `/supervisor`, not on supervisor-2's<br>• supervisor-2 posts sign/reject on that row (DevTools or scratch script) → refused by the server |
| | AC-19 | Sign and reject, remarks | • supervisor-1: Sign → confirm → success → status `Signed`, row leaves the queue<br>• On another row, Reject with an empty remark → error, nothing changes<br>• Reject with a remark → `Rejected by supervisor`; the employee sees the remark; the row never appears in `/hr` |
| | AC-20 | The employee sends the signed request | • employee-1's `Signed` row shows "Send to HR" (and only `Signed` rows do)<br>• Click → confirm → success → `Pending HR`; hr-1's queue shows it<br>• A forged send by anyone else → refused by the server |
| | AC-21 | HR decides, decider recorded | • hr-2 approves → confirm → success → `Approved`, row records the officer "hr-2"<br>• hr-1 rejects another with an empty remark → error; with a remark → `Rejected by HR` + remark<br>• Either of hr-1/hr-2 can handle any queued request<br>• A row never signed or never sent does not appear in the queue |
| | AC-22 | History with status and remarks | • employee-1's list keeps every request ever made, each with status, remarks and timestamps<br>• supervisor-1's page shows requests handled, including their rejections; hr pages show decisions made |
| | AC-23 | Confirmation + success everywhere | • For each write action (submit, sign, reject-supervisor, send, approve, reject-hr): click then Cancel → nothing changes; confirm → a success message shows (same pattern as Sign out AC-10) |
| | AC-24 | No bypass from the browser | • Signed out: all four role URLs redirect to `/login`<br>• As employee-1, post the sign/approve actions with a valid session → refused by the role check<br>• As admin, no mutation action exists to post at all |
| | AC-25 | Admin view-only | • As admin: every record is listed — requester, type, dates, status, remarks, deciding officer<br>• No buttons anywhere |
| | AC-26 *(Extra X1)* | Duplicate block | • With a `Pending supervisor` request held, a second submit is refused naming it<br>• After the first is `Approved` (Final), a new submit is allowed again |
| | AC-27 *(Extra X2)* | Edit before signing | • Edit type/dates on my `Pending supervisor` row → saved with confirm + success, still `Pending supervisor`<br>• A `Signed` row shows no edit button; a forged edit on it → refused |
| | AC-28 *(Extra X3)* | Ask for info | • hr-1 adds a note on a `Pending HR` request → still `Pending HR`, still queued<br>• employee-1's list shows the note on the row |
| | AC-29 *(Extra X4)* | 10 submissions/hour | • Set the dev override `SUBMIT_LIMIT_PER_HOUR=2`; the third submit is refused with a try-again-later message; hr-1 is unaffected; `npm run dev` restart clears the counter |
| | AC-30 *(Extra X5)* | Audit trail | • Do one of each: submit, sign, reject, send, approve → the Admin audit section shows one row per action: who, action, which request, when |
| | AC-31 *(Extra X6)* | Seed samples | • `npm run db:seed` twice → no duplicates; all six statuses exist in the data; the six demo users of Reference B are unchanged |

## 7. Not included (for now)

- Any cancel/withdraw — §5.2 has no such status, and supervisors, HR and
  Admin never file requests at all (§5.3.2), so the self-sign edge cases
  in earlier drafts cannot exist.
- Automatic flow into the HR queue after signing — the brief has the
  employee press Send (FR-04).
- A free-text employee "reason" beyond the Other-type purpose (§7.2 has
  none).
- Half days, hourly leave, holiday calendars (A3).
- Email/SMS notification — the request lists are the trackers (FR-06).
- Audit rows for login/logout — login shipped without them.
- Anything beyond X1–X6: further ideas are FR-09 — decide later,
  specification first, Low.
