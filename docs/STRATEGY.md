# Strategy

Owned by the Strategy thread. Set 2026-10-27 from the owner's answers.
Design and Features threads: read this before picking up work, and check
new ideas against **Principles** and **What we won't do**.

## Goal

**One place where shift leaders see who's here, what they can do, and
whether the shift is covered.** It replaces the team's Excel sheets
(vacations, certifications, system access) with something you open, read
in seconds, and close.

The app does the heavy lifting in the background (coverage maths, skill
gaps, warnings) so the front stays simple.

## Who it's for, in order

| Stage | Users | What they do |
| --- | --- | --- |
| 1. Now | The owner | Everything; tests it on real shifts |
| 2. Pilot | Other shift managers and team leads | Read the overview, plan vacations, keep skills up to date |
| 3. Later | Operators | See their own vacations and certifications, request leave |

Each stage starts only when the one before it is used weekly.

## What it does best (the core)

1. **People and skills:** one people list with certifications and system
   access (yes/no per system). Shows where the team is thin.
2. **Coverage:** vacations against demand per week and process, with
   "what happens if I approve this?" before deciding.
3. **Today:** who's out today and which gaps that leaves.

Supporting tools stay but don't get big new features:

- **Shift HQ:** the owner's own leader standard work.
- **Boards:** frozen. Keep it working; no new features unless a real need
  comes up.
- **Sketch (Excalidraw):** parked until there's a concrete job for it (for
  example, line layouts or a shift plan sketch).

## Principles

1. **Open, look, close.** The dashboard answers the main question without
   a click. Reading beats editing; every edit is one or two taps.
2. **Smart in the back, calm in the front.** Put the effort into the logic
   (coverage, gaps, warnings), not into more screens.
3. **Phone first.** It must work in Safari and Chrome on a phone, including
   Google sign-in. The web app is the product; the native iOS app waits.
4. **Minimum data.** Store only what the overview needs (see **Data
   rules**). If in doubt, leave it out.
5. **Free to run.** Vercel Hobby and Supabase free plan. No recurring paid
   plan without a decision logged in the roadmap.

## Data rules

The app is a private hobby tool, so it must not hold sensitive employee
data.

- **Allowed:** a display name (first name + initial, or a nickname),
  shift, certifications, system access as yes/no, vacation weeks, and
  "out today" without a reason.
- **Not allowed:** absence or sick-leave reasons (health data), lateness
  history, personal ID numbers, contact details, performance notes.
- **It's a mirror, not the record.** Certifications shown here are an
  overview. The official training and qualification record stays in the
  company system (GMP), and the app says so where certifications appear.
- **Retention:** vacation and "out today" entries older than 12 months are
  deleted automatically (to build in R2).
- **Demo data:** always made-up names.

## Sign-in

Google sign-in for everyone, **invite-only**. Invited people just tap
"Sign in with Google" and they're in. Anyone else sees "Ask your shift
manager for access." The owner manages the invite list inside the app
(today it's the `ALLOWED_EMAILS` variable in Vercel).

## What we won't do

- Track lateness or absence reasons. Both are employee monitoring or health
  data, which needs the employer, HR and the union, not a hobby app.
- Replace the company's official training record or HR system.
- Grow Boards into a full monday.com clone.
- Build multi-team admin, work-account SSO or the native iOS app before
  the pilot (stage 2) works.
- Pay for hosting.

## How we know it works

**By February 2027:** the vacation sheet and the certification sheet are
retired, and "who can cover process X in week Y?" takes under 10 seconds.

Leading signs in the first 30 days after Release 1:

1. The owner opens it at 4 of 5 shift starts.
2. One Excel sheet is no longer updated.
3. One other leader signs in at least weekly.

## Open questions

- If the pilot works, does the employer want it? That would need IT, HR and
  data-protection approval, and a paid Vercel plan (Hobby is for
  non-commercial use). Decide before stage 3.
