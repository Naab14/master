# Master redesign — design handover (25 Oct 2026)

Put this folder in the repo as `docs/design/` (this file → `docs/design/HANDOVER.md`).

## Paste this into the new session

> Continue the Master redesign (repo Naab14/master; React 19 + Vite + Tailwind 3 web app in `apps/web`, Node API in `backend/core.js`, Vercel + Supabase, SwiftUI iOS client in `apps/ios`).
> Design exploration is done; read `docs/design/HANDOVER.md` first. The live design canvas is https://claude.ai/code/artifact/40a2f3b0-3052-4318-8e4a-e59924856c04. If you have the Artifact tool, read it there; otherwise use the `.dc.html` sources in `docs/design/mockups/`. Treat the mockups as visual specs, not code to copy.
> Your next job: implement the shared foundation first (theme tokens for 3 themes, typography, spacing, app shell + navigation, reusable controls), then apply it module by module. Keep all business logic, data shapes and API behaviour; preserve `coverage.js`, the scheduling calculations and the 168 existing tests (`npm --prefix apps/web run test:ci`) and the production build.
> Work on a branch, small reviewable commits. Before each step, show me what you'll change; verify responsive layout, keyboard access, contrast, loading/empty/error states and data persistence. Keep explanations short and structured (I'm Abbe, shift manager; I prefer answer-first, 3–5 item chunks).

## Decisions made

| Area | Decision |
|---|---|
| Themes | Keep **three** themes with an app-wide switcher: **Calm** (Notion-like, light), **Arcade** (dark slate game-menu, inspired by surfd.net), **Night shift** (deep purple, Discord/Passionfroot feel). Same layouts; only tokens (colour, fonts, radius, motion) change. |
| Admin landing | The **Calm "Admin · All teams"** page is the landing page for admins: headline numbers across teams, teams table, leave to decide, managers & team leads, and a **"What each role sees"** switch matrix. |
| Team workspace | The **Arcade dashboard** is the workspace for regular users, including shift managers. Menu items appear only if the admin enabled that module for the user's role. Must stay frictionless; to-dos can be added inline from the Objectives panel. |
| Sign-in | Work account (SSO) or email + password; after sign-in an admin picks "All teams" or a team workspace; others go straight to their team. |
| Operator cards | Peppermint-style tilted colour cards; hover straightens/lifts; click flips to certifications + leave. Liked a lot. |
| Schedule density | Ctrl + scroll (and −/+ buttons) switches the time span **3 → 6 → 12 → 18 months**. Zooming out shows *more weeks*; the grid always fills the full screen width and height. Month band + sticky "out per week" row. |
| Sketch tab | New tab embedding Excalidraw (open source), with a sketch list and links to board items / shift log entries. |
| Status colour rule | Green/amber/red mean coverage and work status only; leave uses blue (solid approved, dashed pending, grey draft, dotted requested). |

Still open (ask Abbe): Calm vs Arcade vs Night as the **default** theme; how "Decline" leave should work (see technical notes).

## Artboards on the canvas (`design/mockups/`)

| File | What it shows |
|---|---|
| `Main.dc.html` | Direction A dashboard (Calm): "Needs you" row, shift checklist, shift log, coverage this week, boards status |
| `Vacations.dc.html` | Leave & coverage timeline, S1/S2, decision panel showing coverage impact before approving (numbers computed with the real `coverage.js`) |
| `Foundations.dc.html` | Calm tokens: type scale, surfaces/ink, status vocabularies, controls, spacing |
| `Arcade.dc.html` | Team workspace (Arcade theme) with inline add-objective |
| `Night.dc.html` | Night shift direction: rail + channels + shift-log feed |
| `Team.dc.html` | Operator cards + live 3-theme switcher (contains all three token sets — use as the theme source) |
| `Sketch.dc.html` | Excalidraw tab |
| `Density.dc.html` | Schedule 3/6/12/18-month zoom |
| `SignIn.dc.html`, `Admin.dc.html` | Sign-in and the all-teams admin page |

`design/current-app/` holds screenshots of the app before the redesign.

## Problems found in the current app

1. Each module looks like its own app (three different headers, nested side panels).
2. No type scale: Epilogue black italic + Plus Jakarta + Space Mono, tiny uppercase labels.
3. Colour doesn't follow priority: holiday stripes are the loudest thing; a 0/2 gap is small red text.
4. Dashboard is counts only; Vacations opens at week 15 regardless of today.
5. Editing: `window.confirm()` deletes, US date inputs (mm/dd/yyyy), emoji icons, mixed Swedish/English labels.

## Technical notes (not design — for implementation)

- **Theme switcher:** tokens as CSS variables per theme on `<html data-theme>`; persist per user (localStorage + optional server setting). Replace the 4 Vacation-only themes in `index.css`.
- **Schedule zoom:** React `onWheel` is passive — attach a native `wheel` listener with `{ passive: false }` and `preventDefault()` only when `ctrlKey` is held over the grid (otherwise the browser zooms). Trackpad pinch also sends ctrlKey wheel events. Offer −/+ buttons and Ctrl + = / Ctrl + −. Remember the level per user. Columns `minmax(min, 1fr)`; virtualise rows for big teams; sticky name column/header.
- **ISO week 53 exists in 2026** — compute weeks from dates, never assume 52 (`demand` in data.js only has weeks 1–52).
- **Vacation default view** should centre on the current ISO week, not `startWeek: 15`.
- **"Impact if approved":** run `getAllCoverageForWeek` with that block's status set to `approved` — no algorithm change.
- **"Decline":** the model has no declined status (draft/pending/approved/requested). Decide: delete the block, return to draft, or add a status (touches coverage filters, iOS `Models.swift`, API).
- **Inline add objective:** create a Shift HQ task (`due_date` = today, default category) via the existing `saveTask`; the N shortcut focuses the field; global shortcuts must ignore keys while typing in inputs.
- **Multi-team + auth:** today there's one optional shared `APP_ACCESS_CODE` and one store. Needs user accounts, SSO (work account, e.g. Microsoft Entra ID) or email login, roles (Admin / Shift manager / Team lead / Operator), team scoping of all sections (boards, manageclip, vacation), and a role → module permission table **enforced server-side**, not just hidden in the menu. iOS must follow the same permissions.
- **Chat-style log (Night):** log entries have no author field; multi-user needs auth + author on the Log entity.
- **Excalidraw:** `@excalidraw/excalidraw` (MIT), lazy-loaded (large bundle); store scenes in a new backend section (e.g. `sketches`) through the existing JSON API; links to board items / log entries need ids on both sides.
- **Dates:** use sv-SE format or a custom date picker.
- **Deletes:** replace `window.confirm()` with in-app confirm or undo toast.
- **Seed data:** with demand 2 per process, Etikettering and Granskning/uttag av dok are short every week — "always amber" makes amber meaningless; review demand vs the certification matrix.

## Suggested implementation order

1. Tokens + 3 themes + switcher; fonts; base controls (button, pill, segmented, input, checkbox, toggle, toast).
2. App shell: sidebar/nav, role-aware menu (stub permissions locally until auth exists).
3. Dashboard (team workspace) → Vacations (timeline, zoom levels, decision panel) → Shift HQ → Boards → Team cards.
4. Sketch tab (Excalidraw).
5. Auth, roles, multi-team, admin page (backend + iOS work — plan separately).
