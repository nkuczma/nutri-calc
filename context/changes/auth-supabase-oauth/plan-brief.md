# Wire Supabase OAuth (Google) for Workers Runtime — Plan Brief

> Full plan: `context/changes/auth-supabase-oauth/plan.md`

## What & Why

Stand up authentication for NutriCalc (roadmap F-01) so every signed-in slice that follows — the AI parse north star, save, list, edit, delete — has a verified user and a reachable `auth.uid()` for RLS. Without this foundation, none of the recipe lifecycle can exist. The hard part is doing it on Cloudflare Workers, where the default Supabase auth helper silently fails and only `@supabase/ssr` works.

## Starting Point

The codebase has a bare `@supabase/supabase-js` singleton (`src/lib/supabase.ts`) with no cookie or session handling, used only by a demo `/api/messages` route. There is no proxy/middleware, no login page, no auth routes. Workers config (`wrangler.jsonc`) is already correct: `compatibility_date: "2025-04-01"` + `nodejs_compat`.

## Desired End State

A visitor to any route is redirected to `/login`, signs in with Google, and lands on a protected home page showing their email and a sign-out button. The session round-trips through HTTP-only cookies, refreshes in `proxy.ts` on every request, and works on a deployed Worker — not just locally.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Auth library | `@supabase/ssr` (not `auth-helpers-nextjs`) | The default helper silently fails in the Workers runtime. | Research |
| Protected scope | All routes except `/login` and `/auth/*` | Safest default for an app where all data is user-private. | Plan |
| Sign-in surface | Dedicated `/login` page with provider button | Canonical Supabase + Next 16 pattern; proxy can redirect to it. | Plan |
| Providers in this slice | Google only; GitHub as fast-follow | Sequenced per user; second provider is a copy-paste later. | Plan |
| Demo route + table | Delete both | No dependency; cleaner slate before F-03 adds `recipes`. | Plan |
| `auth.uid()` proof | Show authed email on `/` | Smallest end-to-end proof of the cookie round-trip; RLS proof waits for F-03. | Plan |
| Sign-out | POST to `/auth/signout` Route Handler | User's choice; symmetrical with `/auth/callback`. | Plan |
| Error UX | `/login?error=<code>` + server-rendered banner | Zero client JS, easy to verify. | Plan |
| Tests | None this slice; manual verification | No test-coverage NFR; `main_goal: speed`. | Plan |

## Scope

**In scope:** `@supabase/ssr` install; three client factories (browser/server/proxy); `src/proxy.ts` auth gate; `/login` page + Google button; `/auth/callback` PKCE exchange; `/auth/signout`; protected `/` showing email; deletion of demo route + singleton + `messages` table; documented external setup.

**Out of scope:** GitHub provider; RLS policies and any DB tables (F-03); test runner; public marketing page; service-role key; email/password auth.

## Architecture / Approach

Three `@supabase/ssr` client factories keep server-only code out of the browser bundle: a **browser** client (sign-in button), a **server** client (Server Components / Route Handlers, bound to `next/headers` cookies), and a **proxy** client (bound to the request/response cookie pair). `src/proxy.ts` validates+refreshes the session via `getUser()` on every matched request and redirects unauthenticated traffic to `/login`. OAuth is browser-initiated (PKCE), brokered by Supabase to Google, and returns to `/auth/callback`, which exchanges the code for a session and redirects into the app.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. External setup | Google OAuth client + Supabase provider + env vars (manual, documented) | Redirect-URL allowlist mismatch → callback fails |
| 1. Workers-safe plumbing | `@supabase/ssr` clients, `proxy.ts` gate, demo route removed; redirect works, no sign-in yet | Proxy cookie write-back dropped → session lost silently |
| 2. OAuth flow + UI | Google sign-in, callback, sign-out, email shown on `/` | Cookie round-trip differs on deployed Worker vs local |

**Prerequisites:** A Supabase project (exists) and the Phase 0 dashboard setup before Phase 2 can be verified end-to-end.
**Estimated effort:** ~1–2 after-hours sessions across the 3 phases.

## Open Risks & Assumptions

- The proxy must return the same `NextResponse` whose cookies were set, or the refreshed session is silently dropped — the single most likely bug.
- Local `wrangler dev` does not fully reproduce Workers cookie behavior; the deployed round-trip is the real acceptance gate.
- Shipping Google-only narrows F-01's stated outcome (Google **and** GitHub); GitHub must be tracked as a follow-up so FR-001 is eventually fully satisfied.

## Success Criteria (Summary)

- Signed-out users are redirected to `/login`; Google sign-in returns them to `/` showing their email.
- Sign-out clears the session; re-visiting `/` redirects again.
- The full flow works on a deployed Worker with no exceptions in `wrangler tail`.
