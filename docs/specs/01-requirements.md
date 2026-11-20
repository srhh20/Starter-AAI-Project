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
| To do | AC-01 | Each role signs in and lands on its own home page | • Open `/login`<br>• Sign in as employee-1@budiman.com / `password123`<br>• You should land on `/employee`<br>• Repeat for supervisor-1 → `/supervisor`, hr-1 → `/hr`, admin → `/admin` |
| To do | AC-02 | A wrong password gives the generic error, nothing more | • Open `/login`<br>• Enter employee-1@budiman.com and a wrong password<br>• You should see "Invalid email or password" — no hint about which field was wrong, and you stay on `/login` |
| AC-03 | To do | An unknown email gives the identical generic error | • Open `/login`<br>• Enter nobody@budiman.com / `password123`<br>• The message and timing feel the same as AC-02; no "no such account" text anywhere |
| AC-04 | To do | Emails outside @budiman.com are rejected as bad format | • Open `/login`<br>• Enter alice@gmail.com / `password123`<br>• You should be asked to use your Budiman work email; no database check is described to you |
| AC-05 | To do | Login is case-insensitive on the email | • Open `/login`<br>• Enter EMPLOYEE-1@BUDIMAN.COM / `password123`<br>• You should land on `/employee` |
| AC-06 | To do | Five failures lock that email for 15 minutes | • Open `/login`<br>• Enter employee-1@budiman.com with a wrong password 5 times<br>• On the 6th attempt you should see a "too many attempts, try again later" message<br>• Enter the *correct* password — still refused while locked<br>• Sign in as hr-1 — not affected (lock is per email) |
| AC-07 | To do | A role cannot open another role's pages | • Sign in as employee-1<br>• Type `/admin` in the address bar<br>• You should be silently bounced to `/employee`<br>• Repeat from `/employee` for `/supervisor` and `/hr` as a different role |
| AC-08 | To do | Protected pages require a session | • Sign out (or use a private window)<br>• Open `/employee`, `/supervisor`, `/hr`, `/admin` directly<br>• Each should redirect to `/login` |
| AC-09 | To do | Signed-in users never see the login form | • Sign in as hr-1<br>• Open `/login` and `/`<br>• Each should redirect to `/hr` |
| AC-10 | To do | Sign out needs a confirmation and reports success | • Sign in as admin<br>• Click "Sign out" in the header<br>• Confirm the "Are you sure…" prompt — a wrong click on Cancel should keep you signed in<br>• After confirming you should be on `/login` with a "You have been signed out" message<br>• Press the browser Back button — you should be bounced back to `/login`, not into `/admin` |
| AC-11 | To do | Sessions expire 8 hours after login | • For this test only, set the session lifetime to 60 seconds via a dev setting (e.g. `SESSION_MAX_AGE_SECONDS=60`)<br>• Sign in as employee-1, wait past the expiry, open `/employee`<br>• You should be redirected to `/login` |
| AC-12 | To do | The session cookie is httpOnly, SameSite=Lax, path=/, and Secure on HTTPS | • Sign in, open browser DevTools → Application → Cookies<br>• The session cookie should show `HttpOnly`, `SameSite=Lax`, `Path=/`<br>• `Secure` is set whenever the site is served over HTTPS (absent on `http://localhost` is fine) |
| AC-13 | To do | A tampered cookie is rejected | • Sign in as employee-1<br>• In DevTools, change the user id inside the cookie value (or copy it to another browser and edit it)<br>• Open `/employee`<br>• Signature verification should fail and you should be sent to `/login` — never a database error |
| AC-14 | To do | The seed script loads exactly the six demo users, hashed | • Run `prisma db seed`<br>• Open the SQLite database and check the Users table: six rows matching section 7.2 (emails, names, IC numbers, roles, divisions, designations)<br>• Each password starts with `$2` (bcrypt), not plain `password123`<br>• Run the seed again and re-check: still six rows, no duplicates<br>• All six accounts sign in with `password123` |

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
