# Wire Supabase OAuth (Google) for Workers Runtime — Implementation Plan

## Overview

Establish authentication for NutriCalc on Cloudflare Workers using `@supabase/ssr`. After this change, an unauthenticated visitor to any route is redirected to `/login`, can sign in with Google, lands back on a protected home page that displays their email, and can sign out. The authenticated session round-trips through HTTP-only cookies, is refreshed in `proxy.ts` on every request, and exposes `auth.uid()` server-side for the RLS policies F-03 will author.

This is roadmap foundation **F-01** (`auth-supabase-oauth`), the prerequisite for every signed-in slice (S-01 north star through S-06).

## Current State Analysis

- **Supabase client is a bare singleton.** `src/lib/supabase.ts:3` calls `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)` from `@supabase/supabase-js` at module scope. It has no cookie handling, no session persistence, and is shared between server and (potentially) browser. This pattern **cannot** carry an auth session in the Workers runtime.
- **Only one consumer.** `src/app/api/messages/route.ts` imports that singleton to read/write a demo `messages` table. Nothing in the PRD or roadmap depends on it.
- **No auth surface exists.** No `proxy.ts`/middleware, no `/login`, no `/auth/*` routes, no protected pages. `src/app/page.tsx` is a static placeholder; `src/components/` is empty.
- **Workers runtime is already configured correctly.** `wrangler.jsonc` has `compatibility_date: "2025-04-01"` (required for `process.env` to surface dashboard vars) and `compatibility_flags: ["nodejs_compat"]`. Deployment is `@opennextjs/cloudflare` v1.19.11.
- **`.env.local` holds only** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key (not needed for this slice — anon key + RLS is the model).
- **`@supabase/ssr` is not installed.** `@supabase/supabase-js@^2.106.1` is present; `@supabase/ssr@0.10.3` is available on npm.

### Key Discoveries:

- **Next.js 16 renamed Middleware to Proxy.** Per `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:15`: "Starting with Next.js 16, Middleware is now called Proxy." The file is `proxy.ts` at project root or in `src/`, exporting a default or named `proxy` function plus a `config.matcher`. Proxy runs on the Node.js runtime (proxy doc), which is compatible with `@supabase/ssr`'s cookie adapter.
- **`@supabase/auth-helpers-nextjs` must NOT be used.** `context/foundation/infrastructure.md:83,112` flags it as silently broken in the Workers runtime. Use `@supabase/ssr` with `getAll`/`setAll` cookie handlers everywhere.
- **The session must be refreshed in the proxy via `getUser()`.** The canonical Supabase SSR pattern: the proxy builds a server client bound to the incoming request/outgoing response cookies, calls `supabase.auth.getUser()` (which validates and refreshes the token), and lets the client's `setAll` write refreshed cookies onto the response. Calling `getUser()` (not `getSession()`) is what forces the Auth server validation.
- **OAuth uses PKCE and is browser-initiated.** `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })` must run in the browser so the PKCE code verifier is stored client-side; it returns a provider URL to redirect to. The provider then calls back to `/auth/callback?code=...`, which exchanges the code for a session server-side via `exchangeCodeForSession`.
- **Auth checks belong close to the data, not only in the proxy.** Per `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1119`, the proxy is an optimistic gate; the authoritative `getUser()` check happens in the page/route handler. This slice does both: proxy redirect + server-side `getUser()` on `/`.

## Desired End State

A deployed (or `wrangler dev`) NutriCalc where:
1. Visiting `/` while signed out redirects to `/login`.
2. `/login` shows a "Continue with Google" button (and a plain error banner if `?error=<code>` is present).
3. Clicking it completes Google OAuth and returns to `/`, which displays the signed-in email and a "Sign out" button.
4. "Sign out" clears the session and returns to `/login`.
5. Re-visiting `/` after sign-out redirects to `/login` again.
6. `lint`, type-check, and `build:worker` all pass.

Verify by running the manual flow in `wrangler dev` and once on a deployed Worker (the cookie round-trip is the highest-risk failure mode and only fully exercised on the real runtime).

## What We're NOT Doing

- **GitHub provider** — deferred to a fast-follow change despite FR-001 naming both Google and GitHub. The second provider is ~10 lines once Google works; sequencing per user's call. Tracked as a follow-up.
- **RLS policies / database tables** — F-03 (`recipes-schema-rls`) owns the recipes schema and RLS. This slice only proves `auth.uid()` is reachable server-side; it ships no protected tables.
- **A test runner** — PRD has no test-coverage NFR and `main_goal: speed`. Verification is manual. The next slice with business logic can introduce Vitest.
- **A public marketing landing page** — `/` is auth-gated. A `(public)` route group can be added later if a marketing page is ever specified.
- **Service-role key usage** — anon key + (future) RLS is the access model. No service-role client in this slice.
- **Email/password or magic-link auth** — OAuth only, per FR-001 and Access Control ("No password management").

## Implementation Approach

Three phases. Phase 0 is manual dashboard configuration (no code) captured as a reproducible checklist. Phase 1 lays the Workers-safe Supabase plumbing and the proxy gate, leaving `/login` as a stub — at the end of Phase 1 the app correctly redirects but cannot yet sign anyone in. Phase 2 implements the actual Google OAuth flow and the verification UI.

The three-client split is the canonical `@supabase/ssr` App Router pattern: a **browser** factory (for the client-side sign-in button), a **server** factory (for Server Components and Route Handlers, bound to `next/headers` cookies), and a **proxy** factory (bound to the `NextRequest`/`NextResponse` cookie pair). Keeping them in separate files prevents `next/headers` (server-only) from leaking into the browser bundle.

## Critical Implementation Details

- **Proxy cookie write-back is load-bearing.** The proxy's server client must be constructed with a `setAll` that writes cookies onto **both** the request (so downstream sees them) and the `NextResponse` it returns. If the proxy returns a *new* response object without copying these cookies, the refreshed session is silently dropped — this is the exact "cookies don't survive the round-trip" failure the infrastructure doc warns about. The returned response from the proxy must be the same object whose cookies were set.
- **`getUser()` not `getSession()` in the proxy and on `/`.** `getSession()` reads the cookie without validating it against the Auth server; `getUser()` validates and triggers refresh. Use `getUser()` for any security decision.
- **OAuth `redirectTo` must be an absolute URL on the current origin.** Compute it from the request origin (e.g. `${origin}/auth/callback`) rather than hardcoding, so the same code works in `wrangler dev` (localhost) and on the deployed Worker. The origin must also be registered in Supabase Auth's redirect allowlist (Phase 0).
- **The callback exchanges `code` then redirects.** `/auth/callback` reads `code` from the query string, calls `exchangeCodeForSession(code)` on a server client, and on success redirects to the `next` param (default `/`); on failure redirects to `/login?error=oauth_failed`.

## Phase 0: External Setup (manual, no code)

### Overview

Configure Google OAuth and Supabase Auth so the code in later phases has something to talk to. This is dashboard work; capture it here so it is reproducible.

### Changes Required:

#### 1. Google Cloud OAuth client

**Where**: Google Cloud Console → APIs & Services → Credentials.

**Intent**: Create an OAuth 2.0 Client ID (type: Web application) for NutriCalc. Record the client ID and client secret.

**Contract**: Authorized redirect URI must be the Supabase callback: `https://<project-ref>.supabase.co/auth/v1/callback`. (Supabase brokers the Google handshake; the app never receives Google's redirect directly.)

#### 2. Supabase Auth — enable Google provider

**Where**: Supabase Dashboard → Authentication → Providers → Google.

**Intent**: Enable Google and paste the Google client ID + secret from step 1.

**Contract**: Under Authentication → URL Configuration, add allowed redirect URLs: `http://localhost:8787/auth/callback` (wrangler dev default port — adjust if different), `http://localhost:3000/auth/callback` (next dev), and `https://<worker-domain>/auth/callback` (deployed). Set Site URL to the deployed worker URL.

#### 3. Cloudflare dashboard env vars

**Where**: Cloudflare Dashboard → Workers → nutri-calc → Settings → Variables.

**Intent**: Ensure the public Supabase vars are present so `process.env` surfaces them at runtime (required because `wrangler deploy` does not validate env vars — per `infrastructure.md:85`).

**Contract**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as plain-text vars. Mirror them in `.env.local` for local dev (already present).

### Success Criteria:

#### Automated Verification:

- (none — this phase is manual dashboard configuration)

#### Manual Verification:

- Google OAuth client exists with the Supabase callback URL as an authorized redirect URI
- Supabase Google provider is enabled with the client ID/secret populated
- Supabase redirect allowlist includes localhost (dev) and the deployed worker `/auth/callback`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in both Cloudflare dashboard and `.env.local`

**Implementation Note**: This phase gates Phase 2 verification (you can't complete an OAuth round-trip without it) but does not block Phase 1 code. After confirming the dashboard state, proceed to Phase 1.

---

## Phase 1: Workers-Safe Supabase Plumbing

### Overview

Install `@supabase/ssr`, replace the insecure singleton with three cookie-aware client factories, add the `proxy.ts` auth gate, and remove the demo route. At the end, the app redirects unauthenticated traffic to a stub `/login` and builds cleanly — but no sign-in happens yet.

### Changes Required:

#### 1. Install `@supabase/ssr`

**File**: `package.json`

**Intent**: Add the Workers-compatible SSR helper alongside the existing `@supabase/supabase-js`.

**Contract**: `@supabase/ssr` pinned (`^0.10.3`) in `dependencies`. Run `npm install @supabase/ssr@latest`.

#### 2. Browser client factory

**File**: `src/lib/supabase/browser.ts`

**Intent**: Factory returning a `createBrowserClient` instance for use in Client Components (the sign-in button). Reads the public env vars.

**Contract**: Exports `createClient()` returning `ReturnType<typeof createBrowserClient>`. Uses `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No `next/headers` import (must stay browser-safe).

#### 3. Server client factory

**File**: `src/lib/supabase/server.ts`

**Intent**: Factory returning a `createServerClient` bound to `next/headers` cookies, for Server Components, Server Actions, and Route Handlers.

**Contract**: Exports `async createClient()`. Cookie adapter implements `getAll()` (from `(await cookies()).getAll()`) and `setAll(cookiesToSet)` (writes each via the cookie store, wrapped in try/catch because Server Components cannot set cookies — the documented `@supabase/ssr` pattern). File begins with `import 'server-only'`.

#### 4. Proxy client factory + proxy entrypoint

**File**: `src/lib/supabase/proxy.ts` and `src/proxy.ts`

**Intent**: `proxy.ts` is the Next.js 16 proxy entrypoint (formerly middleware). It builds a server client bound to the incoming request/outgoing response, calls `getUser()` to validate+refresh the session, then redirects unauthenticated requests to `/login`. `src/lib/supabase/proxy.ts` holds the reusable client-construction + session-refresh helper so `proxy.ts` stays thin.

**Contract**:
- `src/lib/supabase/proxy.ts` exports a helper (e.g. `updateSession(request: NextRequest)`) that returns `{ response, user }`. Its `setAll` writes cookies onto both `request.cookies` and the `NextResponse`, and **returns that same response object** (see Critical Implementation Details — dropping this breaks the cookie round-trip).
- `src/proxy.ts` exports default `proxy(request)` and `config.matcher`. Logic: run `updateSession`; if `!user` and the path is not `/login` and does not start with `/auth`, redirect to `/login`. Matcher excludes static assets: `['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']`.

```ts
// src/proxy.ts — gate logic (the one non-obvious ordering)
const { response, user } = await updateSession(request)
const { pathname } = request.nextUrl
const isPublic = pathname === '/login' || pathname.startsWith('/auth')
if (!user && !isPublic) {
  return NextResponse.redirect(new URL('/login', request.url))
}
return response // must be the response whose cookies updateSession set
```

#### 5. Stub `/login` page

**File**: `src/app/login/page.tsx`

**Intent**: Minimal placeholder so the proxy redirect has a target. Real UI lands in Phase 2.

**Contract**: Server Component rendering a heading. No auth logic yet.

#### 6. Remove demo route and old singleton

**File**: delete `src/app/api/messages/route.ts`; delete `src/lib/supabase.ts`

**Intent**: Drop the only consumer of the deprecated shared client and the singleton itself. The `messages` table is dropped manually in Supabase Studio.

**Contract**: No remaining imports of `@/lib/supabase` (the old path). Grep confirms zero references.

### Success Criteria:

#### Automated Verification:

- `@supabase/ssr` present in `package.json` dependencies
- No references to the old `@/lib/supabase` singleton remain: `grep -r "lib/supabase'" src` returns nothing (only `lib/supabase/...` subpaths)
- Type check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Worker build succeeds: `npm run build:worker`

#### Manual Verification:

- Via `npm run preview` (opennextjs build + `wrangler dev` on the built Worker — the Workers runtime, NOT `next dev`): visiting `/` while signed out redirects to `/login`. This validates the OpenNext-bundled proxy, the riskiest integration; `next dev` runs `proxy.ts` natively and would not exercise it.
- `/login` renders the stub heading without errors
- `/auth/anything` is not redirected (reachable, even if it 404s for now)
- The `messages` table has been dropped in Supabase Studio

**Implementation Note**: After automated verification passes, pause for manual confirmation that the redirect behaves before proceeding to Phase 2.

---

## Phase 2: Google OAuth Flow + Verification UI

### Overview

Implement the real sign-in: a Google button on `/login`, the `/auth/callback` PKCE exchange, the `/auth/signout` handler, and a protected home page that proves the session works by showing the user's email.

### Changes Required:

#### 1. Sign-in button (Client Component)

**File**: `src/app/login/SignInWithGoogle.tsx`

**Intent**: Client Component that, on click, creates a browser client and calls `signInWithOAuth` for Google, redirecting to the returned provider URL.

**Contract**: `'use client'`. Calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: \`${location.origin}/auth/callback\` } })`. Renders a button labeled "Continue with Google". Must use the `createClient` from `src/lib/supabase/browser.ts` (`@supabase/ssr`'s cookie-based `createBrowserClient`) — NOT `@supabase/supabase-js` (localStorage default). The PKCE code verifier must be stored in a cookie so the `/auth/callback` server handler can read it; a localStorage-backed client would break `exchangeCodeForSession`.

#### 2. Login page with error banner

**File**: `src/app/login/page.tsx` (replace the Phase 1 stub)

**Intent**: Server Component that renders the sign-in button and, when `searchParams.error` is present, a plain-text error banner.

**Contract**: Reads `searchParams` (Next 16: `searchParams` is a Promise — `await` it). Maps known error codes (`oauth_failed`, `missing_code`) to human-readable messages; falls back to a generic message. Renders `<SignInWithGoogle />`.

#### 3. OAuth callback route handler

**File**: `src/app/auth/callback/route.ts`

**Intent**: Exchange the OAuth `code` for a session, then redirect into the app.

**Contract**: `GET` handler. Reads `code` and `next` (default `/`) from the request URL. If `code` missing → redirect `/login?error=missing_code`. Build the server client, call `exchangeCodeForSession(code)`; on error → redirect `/login?error=oauth_failed`; on success → redirect to `next`. Redirects use the request origin.

#### 4. Sign-out route handler

**File**: `src/app/auth/signout/route.ts`

**Intent**: Clear the session and return to `/login`.

**Contract**: `POST` handler. Builds the server client, calls `auth.signOut()`, redirects to `/login`. (Route Handler per user's choice, not a Server Action.) The cookies cleared by `signOut()` must be written onto the redirect response — use the same server-client cookie store rather than constructing a bare `NextResponse.redirect` that drops them, or the UI returns to `/login` while the session cookie survives ("sign-out that doesn't sign out").

#### 5. Protected home page

**File**: `src/app/page.tsx` (replace placeholder)

**Intent**: Prove the session round-trips: read the user server-side, render their email and a sign-out button.

**Contract**: `async` Server Component. Builds the server client, calls `auth.getUser()`. (The proxy already guarantees a user reaches here, but call `getUser()` for the authoritative check and to display the email.) Renders the email and a `<form action="/auth/signout" method="post"><button>Sign out</button></form>`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Worker build succeeds: `npm run build:worker`

#### Manual Verification:

- In `wrangler dev`: visiting `/` redirects to `/login`; "Continue with Google" completes Google OAuth and returns to `/` showing the signed-in email
- "Sign out" clears the session and returns to `/login`; re-visiting `/` redirects to `/login` again
- Forcing an error (e.g. cancel the Google consent) lands on `/login` with a visible error banner
- The full flow works once on a **deployed** Worker (not just local) — confirms cookies survive the real runtime
- `wrangler tail` shows no exceptions during the flow

**Implementation Note**: The deployed-Worker check is the real acceptance gate — the local dev server does not fully reproduce the Workers cookie behavior. After automated verification passes, pause for manual confirmation of the deployed round-trip.

---

## Testing Strategy

No automated test runner in this slice (see "What We're NOT Doing"). Verification is manual.

### Manual Testing Steps:

1. **Signed-out redirect**: open `/` in a fresh/incognito session → expect redirect to `/login`.
2. **Sign-in happy path**: click "Continue with Google", complete consent → expect return to `/` showing your Google email.
3. **Session persistence**: refresh `/` → expect to stay on `/` (no redirect), email still shown.
4. **Sign-out**: click "Sign out" → expect `/login`; then open `/` → expect redirect to `/login`.
5. **Error path**: start sign-in, cancel at Google consent → expect `/login` with an error banner.
6. **Deployed runtime**: repeat steps 1–4 against the deployed Worker URL.

## Performance Considerations

The proxy runs `getUser()` on every matched request, which makes an Auth-server validation call. This is the standard Supabase SSR cost and is acceptable at MVP scale (PRD `target_scale.qps: low`). Watch the Workers CPU budget (`infrastructure.md` flags 30 ms paid-tier CPU limit) but a single `getUser()` is well within it — the heavy path is the future AI-parse flow, not auth.

## Migration Notes

- The `messages` table must be dropped manually in Supabase Studio (Phase 1 cleanup). No application data depends on it.
- No schema migrations in this slice; Supabase Auth manages `auth.users` itself.

## References

- Change identity: `context/changes/auth-supabase-oauth/change.md`
- Roadmap item F-01: `context/foundation/roadmap.md:70`
- Infrastructure risk register (Supabase SSR / Workers): `context/foundation/infrastructure.md:83,112`
- Next.js 16 Proxy doc: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
- Next.js 16 Authentication guide: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- Current singleton being replaced: `src/lib/supabase.ts:3`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 0: External Setup

#### Manual

- [ ] 0.1 Google OAuth client created with Supabase callback URL as authorized redirect URI
- [ ] 0.2 Supabase Google provider enabled with client ID/secret
- [ ] 0.3 Supabase redirect allowlist includes localhost (dev) and deployed worker `/auth/callback`
- [ ] 0.4 `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Cloudflare dashboard and `.env.local`

### Phase 1: Workers-Safe Supabase Plumbing

#### Automated

- [ ] 1.1 `@supabase/ssr` present in `package.json` dependencies
- [ ] 1.2 No references to the old `@/lib/supabase` singleton remain
- [ ] 1.3 Type check passes: `npx tsc --noEmit`
- [ ] 1.4 Lint passes: `npm run lint`
- [ ] 1.5 Worker build succeeds: `npm run build:worker`

#### Manual

- [ ] 1.6 Via `npm run preview` (Workers runtime), visiting `/` while signed out redirects to `/login`
- [ ] 1.7 `/login` renders the stub heading without errors
- [ ] 1.8 `/auth/*` is reachable (not redirected)
- [ ] 1.9 The `messages` table dropped in Supabase Studio

### Phase 2: Google OAuth Flow + Verification UI

#### Automated

- [ ] 2.1 Type check passes: `npx tsc --noEmit`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Worker build succeeds: `npm run build:worker`

#### Manual

- [ ] 2.4 Sign-in with Google returns to `/` showing the signed-in email
- [ ] 2.5 Sign-out clears the session and returns to `/login`; re-visiting `/` redirects
- [ ] 2.6 Cancelling consent lands on `/login` with a visible error banner
- [ ] 2.7 Full flow works on a deployed Worker
- [ ] 2.8 `wrangler tail` shows no exceptions during the flow
