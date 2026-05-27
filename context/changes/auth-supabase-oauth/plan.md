# Auth Scaffold (Supabase OAuth) Implementation Plan

## Overview

Wire Google OAuth sign-in via Supabase using `@supabase/ssr` — the only Supabase package whose cookie handler is compatible with the Cloudflare Workers edge runtime. Delivers session management, route protection middleware, a sign-in page, an OAuth callback handler, and minimal user presence display on the home page. This is the critical-path foundation (F-01) that `auth.uid()` requires for every downstream slice.

## Current State Analysis

- `@supabase/supabase-js` v2.106.1 installed; `@supabase/ssr` **not** installed.
- `src/lib/supabase.ts` — a single browser-only `createClient()` call. Incompatible with server-side session handling; cannot set cookies in Server Components, Route Handlers, or middleware.
- `src/app/api/messages/route.ts` — imports the soon-to-be-deleted browser client.
- `src/app/page.tsx` — bare placeholder; no auth awareness.
- No middleware, no sign-in route, no OAuth callback route.
- Supabase project URL and anon key already present in `.env.local`.

## Desired End State

After this plan, a visitor to the app:

1. Lands on `/` and sees a "Sign in with Google" prompt if unauthenticated.
2. Clicks the button, is redirected through Google OAuth, lands back at `/auth/callback`, session is set, and lands on `/` where their email address and a "Sign out" button are visible.
3. Any future route outside `["/", "/sign-in", "/auth/**"]` is gated by middleware — unauthenticated visitors are redirected to `/sign-in`.
4. Signing out clears the session and returns the user to `/sign-in`.

### Key Discoveries

- `src/lib/supabase.ts:1-6` — browser-only client; will be deleted entirely and replaced by two SSR-aware factory functions.
- `src/app/api/messages/route.ts:3` — imports the deleted file; must be updated to the server client.
- The roadmap risk note (`context/foundation/roadmap.md:80`) calls out that `auth-helpers-nextjs` silently fails in Workers — `@supabase/ssr` is the only correct package here.
- Next.js 16 (building on Next.js 15 conventions): `cookies()` from `next/headers` is **async** — must be awaited before passing to `createServerClient`.
- `@supabase/ssr` uses PKCE by default; the callback route must call `exchangeCodeForSession(code)`, not pull a token from the URL hash.

## What We're NOT Doing

- GitHub OAuth — scoped out for now; the plan notes where to add a second provider button with no architectural changes.
- Styled auth UI — F-01 delivers functional, unstyled MVP auth. Real polish belongs in a later UI slice.
- Avatar / profile display — email address only; no avatar fetch from the OAuth provider.
- Rate limiting or brute-force protection on the callback route.
- Supabase MFA or password-based auth.
- A test runner — none is configured; manual verification covers this slice.

## Implementation Approach

Install `@supabase/ssr`. Replace the single browser-only Supabase client with two factory functions (server and browser). Add middleware that runs `updateSession` on every request and redirects unauthenticated visitors away from protected routes. Add a `/sign-in` page backed by a Server Action that initiates the PKCE OAuth flow; add a `/auth/callback` route handler that completes the exchange. Update the home page Server Component to read the session and render conditionally.

## Critical Implementation Details

**Async `cookies()` in Next.js 16**: `cookies()` from `next/headers` returns a `Promise`; calling it synchronously (the Next.js 13-era pattern) compiles but produces stale values. The server client factory must `await cookies()` before constructing the Supabase client.

**Middleware cookie mutation must target both the request and the response**: `@supabase/ssr`'s `setAll` in the middleware cookie handler needs to write to both `request.cookies` and the `NextResponse` cookies. Writing to only one breaks session persistence across redirects — the session cookie would be lost on the next request.

**PKCE callback is a `GET` route handler, not a Server Action**: `exchangeCodeForSession(code)` must run in a Route Handler (`/auth/callback/route.ts`), not a Server Action, because Supabase redirects the browser back to this URL with a `?code=` query param. Server Actions don't receive `GET` requests.

---

## Phase 1: SSR Client Utilities

### Overview

Install `@supabase/ssr`, delete the browser-only client, and create two SSR-aware factory functions. Update the only existing consumer (`/api/messages`) to use the server factory. No UI changes — this phase is pure plumbing, verified by a passing build and type-check.

### Changes Required

#### 1. Install `@supabase/ssr`

**File**: `package.json` (via `npm install`)

**Intent**: Add the only Supabase package whose cookie handler works in the Cloudflare Workers edge runtime. The existing `@supabase/supabase-js` remains as a peer dependency (it is a required peer of `@supabase/ssr`).

**Contract**: Run `npm install @supabase/ssr`. After install, `package.json` lists `"@supabase/ssr": "^0.x"` under `dependencies`.

---

#### 2. Delete `src/lib/supabase.ts`

**File**: `src/lib/supabase.ts` — delete

**Intent**: Remove the browser-only client to prevent any future accidental server-side use. All Supabase access will go through the new factory functions below.

**Contract**: File is absent from the repository after this change.

---

#### 3. Create `src/lib/supabase/server.ts`

**File**: `src/lib/supabase/server.ts` — new file

**Intent**: Export an async `createClient()` factory that returns a Supabase server client with read/write cookie access. Used in Server Components, Route Handlers, and Server Actions.

**Contract**: `export async function createClient()` — awaits `cookies()` from `next/headers`, constructs a `createServerClient` from `@supabase/ssr` with a `getAll` / `setAll` cookie adapter, and returns the client. The `setAll` catch block silently swallows errors (expected — setting cookies from a Server Component without middleware is a no-op, not an error).

---

#### 4. Create `src/lib/supabase/client.ts`

**File**: `src/lib/supabase/client.ts` — new file

**Intent**: Export a `createClient()` factory for use in Client Components (`'use client'`). Returns a browser-side Supabase client using `createBrowserClient` from `@supabase/ssr`.

**Contract**: `export function createClient()` — synchronous; calls `createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` and returns the result.

---

#### 5. Update `src/app/api/messages/route.ts`

**File**: `src/app/api/messages/route.ts`

**Intent**: Swap the deleted browser client import for the new server factory. The route handler's logic is unchanged — only the import and client construction differ.

**Contract**: Replace `import { supabase } from '@/lib/supabase'` with `import { createClient } from '@/lib/supabase/server'`; replace the module-level `supabase` constant with `const supabase = await createClient()` at the top of each handler function.

---

### Success Criteria

#### Automated Verification

- Build passes: `npm run build`
- TypeScript compiles with no errors: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- `src/lib/supabase.ts` is absent: `test ! -f src/lib/supabase.ts`
- Both new files exist: `test -f src/lib/supabase/server.ts && test -f src/lib/supabase/client.ts`

#### Manual Verification

- None required for this phase — no UI surface yet.

**Implementation Note**: After all automated checks pass, proceed directly to Phase 2. No manual gate here.

---

## Phase 2: Middleware — Session Refresh + Route Guard

### Overview

Create `src/middleware.ts` that runs on every non-static request. It performs two jobs: (1) refreshes the Supabase session cookie so it doesn't expire mid-session, and (2) redirects unauthenticated visitors away from protected routes. Public routes: `/`, `/sign-in`, and anything under `/auth/`.

### Changes Required

#### 1. Create `src/middleware.ts`

**File**: `src/middleware.ts` — new file

**Intent**: On every matched request, refresh the Supabase session using `@supabase/ssr`'s `createServerClient` with a request/response cookie adapter. After refresh, if the user is unauthenticated and the requested path is not in the public allow-list (`/`, `/sign-in`, `/auth/**`), redirect to `/sign-in`. Return the (potentially cookie-mutated) response for all other cases.

**Contract**: Export `async function middleware(request: NextRequest): Promise<NextResponse>`. The cookie adapter writes to both `request.cookies` and a `NextResponse` created from the request (see Critical Implementation Details — both sides must be written). After constructing the client, call `supabase.auth.getUser()` — use `getUser()` not `getSession()` (getSession reads from the cookie cache without server-side verification; getUser hits the Supabase auth server and is the safe call for authorization decisions).

Export a `config` object with a `matcher` that excludes `_next/static`, `_next/image`, `favicon.ico`, and static file extensions so the middleware doesn't run on assets.

Public path check: `pathname === '/'`, `pathname === '/sign-in'`, or `pathname.startsWith('/auth/')`.

---

### Success Criteria

#### Automated Verification

- Build passes: `npm run build`
- TypeScript compiles with no errors: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification

- Visit `http://localhost:3000/any-non-existent-route` while signed out → browser redirects to `/sign-in`.
- Visit `http://localhost:3000/` while signed out → page loads (no redirect).
- Visit `http://localhost:3000/sign-in` while signed out → page loads (no redirect; the page may show a 404 since it doesn't exist yet — that's fine for this phase; what matters is no redirect loop).

**Implementation Note**: After automated checks pass, run `npm run dev` and verify the manual routing behaviour above before proceeding to Phase 3.

---

## Phase 3: Auth Flow — Sign-in Page, Callback, Home Page, Sign-out

### Overview

Wire the full OAuth round-trip: a `/sign-in` page with a Google OAuth button (using a Server Action), an `/auth/callback` route handler that completes the PKCE exchange and issues the session cookie, a shared `auth.ts` Server Actions file for sign-in and sign-out, and an updated home page that reads the session and renders conditionally.

### Changes Required

#### 1. Create `src/app/actions/auth.ts`

**File**: `src/app/actions/auth.ts` — new file

**Intent**: House the two auth Server Actions shared across pages: `signIn` (initiates Google OAuth) and `signOut` (clears the session and redirects to `/sign-in`). Co-locating them prevents duplication between the sign-in page and the home page.

**Contract**: Mark file with `'use server'`. Export `async function signIn()` — creates the server client, calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: \`\${origin}/auth/callback\` } })` (origin comes from `headers().get('origin')`), redirects to `data.url` on success, or to `/sign-in?error=oauth_failed` on error. Export `async function signOut()` — creates the server client, calls `supabase.auth.signOut()`, then `redirect('/sign-in')`.

---

#### 2. Create `src/app/sign-in/page.tsx`

**File**: `src/app/sign-in/page.tsx` — new file

**Intent**: The public sign-in page. Shows a "Sign in with Google" button wired to the `signIn` Server Action. If the `?error=` query param is present, displays a brief human-readable error message above the button.

**Contract**: Server Component. Reads `searchParams.error` — map known values (`oauth_failed`, `callback_failed`) to friendly strings; unknown values show a generic "Sign-in failed, please try again." message. Renders a `<form action={signIn}>` containing a `<button type="submit">Sign in with Google</button>`. No GitHub button for now (add a second `<form action={signInGithub}>` here when GitHub is wired — no structural changes needed).

---

#### 3. Create `src/app/auth/callback/route.ts`

**File**: `src/app/auth/callback/route.ts` — new file

**Intent**: Complete the PKCE code exchange. Supabase redirects the browser here after Google authentication with a `?code=` query parameter. This handler exchanges the code for a session cookie and redirects the user home.

**Contract**: Export `async function GET(request: Request)`. Extract `code` from `new URL(request.url).searchParams`. If `code` is present, call `supabase.auth.exchangeCodeForSession(code)`. On success, redirect to `/` (or the `?next=` param if present for future use). On error or absent code, redirect to `/sign-in?error=callback_failed`.

---

#### 4. Update `src/app/page.tsx`

**File**: `src/app/page.tsx`

**Intent**: Make the home page auth-aware. A signed-in user sees their email address and a "Sign out" button. A signed-out user sees a "Sign in with Google" link pointing to `/sign-in`.

**Contract**: Async Server Component. Call `await createClient()` then `supabase.auth.getUser()`. If `user` is present, render the email and a `<form action={signOut}>` with a Sign-out button. If no user, render a brief landing prompt and a `<a href="/sign-in">` link. Keep Tailwind classes consistent with the existing `bg-zinc-50` / `dark:bg-zinc-900` palette already in the file.

---

### Success Criteria

#### Automated Verification

- Build passes: `npm run build`
- TypeScript compiles with no errors: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- All four new/modified files exist:
  - `src/app/actions/auth.ts`
  - `src/app/sign-in/page.tsx`
  - `src/app/auth/callback/route.ts`
  - `src/app/page.tsx` (modified)

#### Manual Verification

- **Sign-in flow**: Visit `http://localhost:3000/` signed out → see landing with "Sign in with Google" link → navigate to `/sign-in` → click the button → complete Google OAuth → land back on `/` → see your email address and a "Sign out" button.
- **Sign-out**: Click "Sign out" → redirected to `/sign-in` → visiting `/` shows the landing (not the email).
- **Session persistence**: After sign-in, refresh the page → still signed in (session cookie survived the reload).
- **Route guard**: While signed in, visit `http://localhost:3000/protected-does-not-exist` → redirected to `/sign-in` (expected; the route 404s after redirect is correct behaviour for this phase).
- **OAuth error**: Simulate an error by visiting `/sign-in?error=oauth_failed` → a brief error message is visible above the sign-in button.

**Implementation Note**: This phase requires a live Supabase project with Google OAuth configured (OAuth app in Google Cloud Console + Supabase Dashboard → Auth → Providers → Google). The callback URL registered with Google must be `{your-supabase-project-url}/auth/v1/callback` (Supabase's internal callback — not `/auth/callback` in the Next.js app). The Next.js `/auth/callback` route is the redirect URI set in `supabase.auth.signInWithOAuth`'s `redirectTo` option, which Supabase's auth service in turn redirects to after it processes the provider's response.

Pause here for manual confirmation that the full OAuth loop works end-to-end before marking this change as complete.

---

## Testing Strategy

### No test runner is configured

Per `CLAUDE.md`: no test runner is configured yet. Manual verification covers F-01.

### Manual Testing Steps

1. Sign-out → visit `http://localhost:3000/` → confirm landing prompt is shown, not a redirect.
2. Click through to `/sign-in` → click Google button → complete OAuth → confirm landing on `/` with email visible.
3. Refresh the page → confirm session survives (email still visible).
4. Click "Sign out" → confirm redirect to `/sign-in` → confirm `/` shows landing (not email).
5. While signed out, navigate to `http://localhost:3000/sign-in?error=oauth_failed` → confirm error message is visible.
6. While signed out, navigate to `http://localhost:3000/recipes` (non-existent) → confirm redirect to `/sign-in`.
7. Repeat steps 1–4 in a fresh private/incognito window to rule out local browser state.

## Migration Notes

The deletion of `src/lib/supabase.ts` is the only breaking change. The only consumer (`src/app/api/messages/route.ts`) is updated in Phase 1 before the file is deleted. No database migrations are required for F-01 — auth is handled entirely by Supabase's managed auth service.

**Supabase Dashboard setup** (one-time, before Phase 3 manual testing):
1. Auth → Providers → Google → enable, paste Client ID + Client Secret from Google Cloud Console.
2. Auth → URL Configuration → add `http://localhost:3000/auth/callback` to the Redirect URLs allow-list (and the production URL when deploying).

## Performance Considerations

The middleware runs on every non-static request. `supabase.auth.getUser()` makes a network call to the Supabase auth server to validate the session JWT. In the Cloudflare Workers runtime, this call is ~50–100 ms on a warm worker. Acceptable for F-01; if middleware latency becomes a concern in later slices, switch to `getSession()` for public routes where server-side JWT verification is not required (noting that `getSession()` trusts the cookie cache without re-validating with the auth server).

## References

- Roadmap: `context/foundation/roadmap.md` (F-01, lines 70–82)
- PRD: `context/foundation/prd.md` (FR-001, Access Control)
- `@supabase/ssr` Next.js guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Existing Supabase client (to be deleted): `src/lib/supabase.ts`
- Messages API (will be updated): `src/app/api/messages/route.ts:3`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: SSR Client Utilities

#### Automated

- [x] 1.1 Build passes: `npm run build` — 1dec878
- [x] 1.2 TypeScript compiles: `npx tsc --noEmit` — 1dec878
- [x] 1.3 Linting passes: `npm run lint` — 1dec878
- [x] 1.4 `src/lib/supabase.ts` is absent — 1dec878
- [x] 1.5 `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` exist — 1dec878

### Phase 2: Middleware — Session Refresh + Route Guard

#### Automated

- [x] 2.1 Build passes: `npm run build`
- [x] 2.2 TypeScript compiles: `npx tsc --noEmit`
- [x] 2.3 Linting passes: `npm run lint`

#### Manual

- [x] 2.4 Unauthenticated visit to a non-public route redirects to `/sign-in`
- [x] 2.5 Unauthenticated visit to `/` loads without redirect
- [x] 2.6 Unauthenticated visit to `/sign-in` loads without redirect loop

### Phase 3: Auth Flow — Sign-in Page, Callback, Home Page, Sign-out

#### Automated

- [ ] 3.1 Build passes: `npm run build`
- [ ] 3.2 TypeScript compiles: `npx tsc --noEmit`
- [ ] 3.3 Linting passes: `npm run lint`
- [ ] 3.4 All four new/modified auth files exist

#### Manual

- [ ] 3.5 Full Google OAuth sign-in flow completes; email visible on home page
- [ ] 3.6 Sign-out clears session; home page shows landing
- [ ] 3.7 Session survives page refresh
- [ ] 3.8 Route guard redirects unauthenticated user to `/sign-in`
- [ ] 3.9 `/sign-in?error=oauth_failed` displays an error message
