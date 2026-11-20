# Budiman HRMS — Leave Request module

The repo builds a leave-request web app for Budiman Company: employees submit
leave, a supervisor signs it, HR decides, Admin views. Nothing is built yet.
The brief is `docs/Agentic AI - HRMS Doc.pdf` — read it before building.

## What it is built with

Next.js (App Router, TypeScript) with React, Tailwind CSS, SQLite through
Prisma, and bcryptjs for password hashing. Logins use signed session cookies.
Versions are pinned in `package.json` — do not add or upgrade packages.

## How to run
    npm install
    npm run dev     # http://localhost:3000

Needs Node.js 20.9+. `npm run lint` must pass before a task is done.

## Where things live

- `docs/Agentic AI - HRMS Doc.pdf` — the brief: roles, rules, fields, demo users.
- `docs/templates/` — blank spec files to copy; `docs/specs/` — the filled specs.
- `src/app/` — all app code (pages, server actions).

## How to work

1. Spec first, code second: write/copy the three specs in `docs/specs/`
   (requirements, design, tasks) from the brief and get them approved before
   building. If behaviour must change, fix the spec first, then the code.
2. Build one task at a time from `03-tasks.md`, High priority first, login
   first. Mark each task Done when its checks pass.
3. The brief is fixed: four roles, statuses, business rules, and the demo
   users in section 7.2. Follow them exactly; do not invent features.
4. Security: follow OWASP Top 10 and section 7.5. Hash every password, check
   the role on every page and action, never trust the browser.
5. Every commit message uses conventional commits, e.g. `feat: add login page`,
   `fix: reject expired session`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
