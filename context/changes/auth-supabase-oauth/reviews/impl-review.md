<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Scaffold (Supabase OAuth)

- **Plan**: context/changes/auth-supabase-oauth/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-05-27
- **Verdict**: REJECTED
- **Findings**: 2 critical  4 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Open redirect via unvalidated `next` param in callback

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/auth/callback/route.ts:14
- **Detail**: The `next` query param is read directly from the URL and spliced into the redirect without validation: `return NextResponse.redirect(\`${origin}${next}\`)`. An attacker can craft `/auth/callback?code=...&next=//evil.example.com/steal` and redirect the user off-site after a legitimate sign-in (post-OAuth redirect injection).
- **Fix A ⭐ Recommended**: Validate `next` is a safe relative path before use
  ```ts
  const rawNext = searchParams.get('next') ?? '/'
  const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
  return NextResponse.redirect(`${origin}${safeNext}`)
  ```
  - Strength: Eliminates the entire redirect-injection class; two-line change; no callers pass `?next=` today so no breakage.
  - Tradeoff: Doesn't defend against path-traversal variants like `/..%2Fevil`; tighten with an allowlist if deep-linking is extended.
  - Confidence: HIGH — standard hardening for every post-auth redirect.
  - Blind spot: None significant for the current usage scope.
- **Decision**: FIXED — validated `next` is a safe relative path (callback/route.ts).

---

### F2 — Messages API endpoints are completely unauthenticated

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/api/messages/route.ts:4–16, 18–38
- **Detail**: The plan scoped this file to an import swap only — handlers' logic was intentionally unchanged. However, now that the auth scaffold is live, both GET (read all messages) and POST (insert arbitrary content) are reachable without any session. The middleware route-guard only redirects browsers on page routes; a direct API fetch bypasses it entirely. If the Supabase `anon` role has INSERT permission on the messages table, unauthenticated writes go straight to the database.
- **Fix A ⭐ Recommended**: Add `getUser()` auth check to both handlers now
  ```ts
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  ```
  - Strength: Uses the already-instantiated supabase client; ~4 lines per handler; consistent with how page.tsx checks auth.
  - Tradeoff: Minor scope expansion beyond the plan's import-only intent, but the auth tooling is now present and the gap is live.
  - Confidence: HIGH — identical pattern is available in page.tsx.
  - Blind spot: Doesn't verify what the Supabase anon role's RLS policies allow — check the Supabase dashboard to confirm.
- **Fix B**: Defer to a dedicated API auth slice
  - Strength: Respects the original plan's scope boundary strictly.
  - Tradeoff: Leaves an unauthenticated write endpoint live in production until that slice ships; risk depends on RLS policy state.
  - Confidence: MEDIUM — acceptable only if RLS prevents anon inserts.
  - Blind spot: RLS policy status is not verified here.
- **Decision**: FIXED — endpoint was only a Supabase connection test; removed entirely (deleted src/app/api/messages/route.ts). This also resolves F6 and F9.

---

### F3 — Redirect path drops Supabase-refreshed session cookies

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/middleware.ts:56
- **Detail**: When an unauthenticated visitor hits a protected route, the middleware creates a fresh `NextResponse.redirect(...)` and returns it. Any refreshed token cookies that @supabase/ssr wrote into `supabaseResponse` during `getUser()` are silently dropped. On a user whose token was refreshed mid-request on a protected path, the next request carries the old expired cookie — causing a redirect loop or forced re-login.
- **Fix**: Forward supabaseResponse cookies onto the redirect:
  ```ts
  const redirectResponse = NextResponse.redirect(signInUrl)
  supabaseResponse.cookies.getAll().forEach(c =>
    redirectResponse.cookies.set(c.name, c.value)
  )
  return redirectResponse
  ```
  - Strength: Exact pattern recommended by @supabase/ssr docs for this middleware setup; prevents the session-loss edge case.
  - Tradeoff: None — zero risk, adds 3 lines.
  - Confidence: HIGH — this is a known @supabase/ssr footgun.
  - Blind spot: None significant.
- **Decision**: FIXED — forwarded supabaseResponse cookies onto the redirect (middleware.ts).

---

### F4 — `Origin` request header used unvalidated in OAuth redirectTo

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/actions/auth.ts:10, 15
- **Detail**: `origin` is taken from `headers().get('origin')` and interpolated directly into the `redirectTo` option for Supabase's signInWithOAuth. A forged Server Action call with `Origin: https://evil.example.com` produces `redirectTo: https://evil.example.com/auth/callback`. Supabase's dashboard Redirect URLs allowlist mitigates this — but a loose or wildcard entry makes it exploitable.
- **Fix A ⭐ Recommended**: Derive origin from an env var, not the header
  ```ts
  const origin = process.env.NEXT_PUBLIC_SITE_URL
  ```
  - Strength: Eliminates the attack surface entirely; conventional pattern in every Supabase SSR example; NEXT_PUBLIC_SITE_URL already fits the .env.local schema.
  - Tradeoff: Requires adding the env var to .env.local and Cloudflare Workers env config.
  - Confidence: HIGH — this is the approach Supabase's own docs recommend.
  - Blind spot: None significant.
- **Fix B**: Validate the header against a known-good list
  - Strength: No env var required; keeps dynamic origin logic.
  - Tradeoff: Harder to maintain; list must stay in sync with deployment URLs.
  - Confidence: MEDIUM.
  - Blind spot: Doesn't account for preview deployment URLs.
- **Decision**: SKIPPED — mitigated by Supabase dashboard Redirect URLs allowlist; revisit if allowlist is loosened.

---

### F5 — signOut discards the error return value

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/actions/auth.ts:29
- **Detail**: `await supabase.auth.signOut()` is called but its return value is discarded. On a Supabase auth server error or network failure, the session cookie is not cleared, but the user is still redirected to /sign-in — leaving them in a broken state where the UI says signed-out but the cookie is still live.
- **Fix**: Destructure and handle the error:
  ```ts
  const { error } = await supabase.auth.signOut()
  if (error) redirect('/sign-in?error=signout_failed')
  redirect('/sign-in')
  ```
- **Decision**: FIXED — destructured { error } and redirect to /sign-in?error=signout_failed on failure (auth.ts).

---

### F6 — request.json() in messages POST not wrapped in try/catch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/messages/route.ts:20
- **Detail**: `await request.json()` throws a SyntaxError if the client sends a non-JSON body (malformed JSON, empty body, wrong Content-Type). The thrown error propagates as an unhandled 500 instead of a clean 400.
- **Fix**: Wrap in try/catch:
  ```ts
  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  ```
- **Decision**: RESOLVED — moot; the messages route was removed per F2.

---

### F7 — Unplanned change: eslint.config.mjs adds .open-next/** ignore

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.mjs
- **Detail**: Not in the plan. The change adds `.open-next/**` to the ESLint globalIgnores list to prevent linting Cloudflare Workers build artifacts. Benign and consistent with the Cloudflare deployment target.
- **Fix**: No code change needed. Document as an addendum line in plan.md if desired.
- **Decision**: SKIPPED — benign build-artifact ignore; left undocumented per user.

---

### F8 — Callback route uses `Request` where siblings use `NextRequest`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/auth/callback/route.ts:4
- **Detail**: Function signature is `GET(request: Request)` while the sibling src/app/api/messages/route.ts uses `NextRequest`. Both compile; inconsistency matters if this handler is extended to use .nextUrl or .cookies helpers.
- **Fix**: Change to `import { NextRequest, NextResponse } from 'next/server'` and update the signature to `GET(request: NextRequest)`.
- **Decision**: FIXED — switched to NextRequest import and signature (callback/route.ts).

---

### F9 — Double-quote strings in messages route vs. single-quote project-wide

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/api/messages/route.ts:1
- **Detail**: Imports use double-quote delimiters (`"next/server"`, `"@/lib/supabase/server"`) while all other files in the project use single quotes.
- **Fix**: `npm run lint -- --fix` will auto-correct this.
- **Decision**: RESOLVED — moot; the messages route was removed per F2.
