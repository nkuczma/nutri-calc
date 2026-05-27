# Auth Scaffold (Supabase OAuth) — Plan Brief

> Full plan: `context/changes/auth-supabase-oauth/plan.md`

## What & Why

Wire Google OAuth sign-in into NutriCalc using `@supabase/ssr` — the only Supabase package whose cookie handler is compatible with the Cloudflare Workers edge runtime. This is F-01, the critical-path foundation that makes `auth.uid()` available for RLS and unlocks every signed-in slice (S-01 through S-06 and F-03).

## Starting Point

`@supabase/supabase-js` is installed and a Supabase project is provisioned, but the existing `src/lib/supabase.ts` is a browser-only client that cannot handle server-side sessions. There is no middleware, no sign-in route, no OAuth callback, and no auth-aware UI.

## Desired End State

A visitor to the app sees a "Sign in with Google" prompt. After completing OAuth, they land on the home page where their email address and a "Sign out" button are visible. Any future app route outside `["/", "/sign-in", "/auth/**"]` is gated at the middleware level — unauthenticated visitors are redirected to `/sign-in` automatically.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Auth package | `@supabase/ssr` (not `auth-helpers-nextjs`) | `auth-helpers-nextjs` silently fails in the Cloudflare Workers edge runtime | Roadmap risk note |
| OAuth providers | Google only for now | Start with the widest-reach provider; GitHub can be added later with no structural changes | Plan |
| Homepage behaviour | Public landing with sign-in link | Home page (`/`) is public; a signed-out user sees a prompt rather than an immediate redirect | Plan |
| Sign-in URL | `/sign-in` (flat route) | Short, memorable, minimal nesting | Plan |
| Post-auth redirect | Back to `/` | No separate dashboard route yet; home page shows different content per auth state | Plan |
| Auth errors | `/sign-in?error=…` + brief message | User-facing feedback without a crash; clean recovery path | Plan |
| User presence | Email + sign-out button on home page | Proves the auth loop closed end-to-end; keeps F-01 scope tight | Plan |
| Old supabase client | Delete entirely; update the messages route | Prevents two conflicting clients from coexisting and being used interchangeably | Plan |
| Route guard scope | All routes except `/`, `/sign-in`, `/auth/**` | Enforces the PRD "unauthenticated users cannot access any recipe data" requirement at the edge | Plan |

## Scope

**In scope:**
- Install `@supabase/ssr`
- `src/lib/supabase/server.ts` — async server client factory
- `src/lib/supabase/client.ts` — browser client factory
- Delete `src/lib/supabase.ts`; update `/api/messages` route
- `src/middleware.ts` — session refresh + route guard
- `src/app/sign-in/page.tsx` — Google OAuth button + error display
- `src/app/auth/callback/route.ts` — PKCE code exchange
- `src/app/actions/auth.ts` — `signIn` + `signOut` Server Actions
- Update `src/app/page.tsx` — conditional auth UI (email + sign-out | landing)

**Out of scope:**
- GitHub OAuth (no structural block to adding later)
- Styled auth UI / avatar display
- Supabase MFA or password auth
- Rate limiting on the callback route
- A test runner

## Architecture / Approach

Three-phase delivery: (1) replace the browser-only client with SSR-aware factory functions; (2) add middleware for session refresh and route protection; (3) wire the full OAuth round-trip UI. The PKCE flow: sign-in page form → Server Action calls `signInWithOAuth` → redirect to Google → Google redirects to `/auth/callback` → callback handler calls `exchangeCodeForSession(code)` → session cookie set → redirect to `/`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. SSR Client Utilities | `@supabase/ssr` installed; two factory functions; messages route updated | Async `cookies()` — must await in server factory |
| 2. Middleware | Session refresh + route guard on every request | Cookie mutation must target both request AND response |
| 3. Auth Flow | Sign-in page, PKCE callback, home page auth UI, sign-out | Requires live Supabase project with Google OAuth configured |

**Prerequisites:** Supabase project provisioned (✓ done — `.env.local` has URL + anon key). Google OAuth app created in Google Cloud Console with the Supabase callback URL registered. Supabase Dashboard → Auth → Providers → Google enabled with the Client ID + Secret.

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Google OAuth app creation and Supabase provider setup are manual steps outside the code — Phase 3 manual verification cannot start until these are done.
- Cloudflare Workers CPU budget: session refresh via `getUser()` makes a network call per request (~50–100 ms). Acceptable for MVP; not expected to be a bottleneck at this scale.
- `@supabase/ssr` version compatibility with Next.js 16 / React 19 — verified via the Supabase SSR guide; no known conflicts.

## Success Criteria (Summary)

- A real Google account can sign in, land on the home page, see their email, and sign out — in a single end-to-end test.
- An unauthenticated browser visiting any non-public route is redirected to `/sign-in` by the middleware.
- `npm run build` and `npx tsc --noEmit` pass on the final diff.
