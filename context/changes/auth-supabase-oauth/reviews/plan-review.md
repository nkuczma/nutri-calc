<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Wire Supabase OAuth (Google) for Workers Runtime

- **Plan**: `context/changes/auth-supabase-oauth/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-26
- **Verdict**: SOUND (one warning addressed)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

5/5 paths ✓ (`src/lib/supabase.ts`, `src/app/api/messages/route.ts`, `src/app/page.tsx`, `wrangler.jsonc`, `package.json`), `@supabase/ssr` not-installed ✓ (matches plan), `server-only` resolves via `next` ✓, OpenNext adapter middleware support confirmed ✓ (v1.19.11 `loadMiddlewareManifest`/`copyMiddlewareResources`), single consumer of old singleton confirmed ✓ (only `messages/route.ts`), brief↔plan ✓.

## Findings

### F1 — Phase 1 redirect check permits `next dev`, bypassing the OpenNext-bundled proxy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Manual Verification (line 190), Progress 1.6
- **Detail**: The highest-risk claim is that Next 16 `proxy.ts` works through the OpenNext Cloudflare bundle. Adapter support confirmed statically, but `next dev` runs `proxy.ts` natively — not through the bundled Worker. Phase 1's check permitted `next dev`, so an implementer could validate the redirect without ever exercising the bundled proxy, deferring the real risk to Phase 2's deployed check and conflating an auth bug with a proxy-bundling bug.
- **Fix**: Change Phase 1 manual verification 1.6 to require `npm run preview` (Workers runtime), not `next dev`.
- **Decision**: FIXED (Fix in plan — manual 1.6 + Progress 1.6 updated to require `npm run preview`)

### F2 — PKCE verifier cookie dependency is implicit

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 #1 (sign-in button) ↔ #3 (callback)
- **Detail**: `exchangeCodeForSession` only works if the PKCE verifier set at sign-in is readable server-side — which holds because `@supabase/ssr`'s `createBrowserClient` stores it in a cookie (vs. `@supabase/supabase-js`'s localStorage). The plan specified `createBrowserClient` but didn't state the cross-step dependency; a future client swap would break the exchange invisibly.
- **Fix**: Add a sentence to Phase 2 #1's Contract requiring the cookie-based `createClient` from `src/lib/supabase/browser.ts`.
- **Decision**: FIXED (Fix in plan — Phase 2 #1 contract now mandates the cookie-based browser client and explains why)

### F3 — Sign-out cookie clearing must land on the redirect response

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 #4 (sign-out route handler)
- **Detail**: `signOut()` clears auth cookies via the server-client cookie store; the contract didn't state those cleared cookies must be on the redirect response. An implementer building a bare `NextResponse.redirect` separately could ship a "sign-out that doesn't sign out."
- **Fix**: Add to Phase 2 #4's Contract that cleared cookies must be written onto the redirect response.
- **Decision**: FIXED (Fix in plan — Phase 2 #4 contract now states the cookie-on-redirect requirement)
