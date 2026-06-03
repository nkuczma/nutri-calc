# Landing Page Implementation Plan

## Overview

Replace the sparse root page (`/`) with a proper hero landing page that communicates NutriCalc's value proposition to unauthenticated visitors. Authenticated users are server-side redirected to `/parse` — they never see the landing content.

## Current State Analysis

`src/app/page.tsx` is a minimal auth gate: a heading, a one-sentence description ("Parse recipes and track nutrients."), and a sign-in link. It conveys no value proposition and gives first-time visitors no reason to sign up.

The page is a Next.js async Server Component using Supabase's server client for auth. The existing zinc/dark-mode Tailwind design system is established throughout the app.

### Key Discoveries

- `src/app/page.tsx:5` — async Server Component, already fetches the Supabase user; redirect logic fits naturally here
- `src/app/actions/auth.ts` — `signOut` server action; not needed on the new landing page (unauthenticated only)
- PRD value proposition (verbatim): "existing apps hide their own database gaps… NutriCalc surfaces those gaps transparently — every nutrient is either a value or an explicit 'missing' flag"
- PRD persona: health-conscious home cook who finds recipes online and wants full nutritional breakdown without manual entry

## Desired End State

Unauthenticated visitors hitting `/` see a hero section with a sharp headline, a supporting sub-headline surfacing the transparent-missing-data differentiator, and a single "Sign in with Google" CTA. Authenticated users are redirected server-side to `/parse` and never see the landing content.

### Key Discoveries

- No new routes, components, or data fetching needed
- Visual style: zinc color scheme, dark mode support — consistent with `/parse` and `/sign-in`

## What We're NOT Doing

- No "how it works" step list
- No footer section
- No new accent colors or design tokens
- No animations or transitions
- No A/B testing or analytics instrumentation
- No changes to `/sign-in`, `/parse`, or any other page

## Implementation Approach

Rewrite `src/app/page.tsx` in place. Add `redirect('/parse')` immediately after the auth check for authenticated users. Replace the unauthenticated branch with a hero layout: large headline, sub-headline, sign-in CTA.

Copy decisions (grounded in PRD):
- **Headline:** "Know what's actually in your recipes" — addresses the pain (inaccurate data) without jargon
- **Sub-headline:** "Paste any recipe and get a full nutritional breakdown. Missing nutrients are flagged explicitly — never quietly treated as zero." — surfaces the differentiator in plain language

## Phase 1: Landing Hero

### Overview

Rewrite `src/app/page.tsx` to redirect authenticated users and render a hero landing page for unauthenticated visitors.

### Changes Required

#### 1. Root Page Rewrite

**File:** `src/app/page.tsx`

**Intent:** Replace the minimal auth gate with (a) a server-side redirect for authenticated users and (b) a hero section for unauthenticated visitors with headline, sub-headline, and sign-in CTA.

**Contract:** The component remains an `async` Server Component. Import `redirect` from `next/navigation`. After fetching the Supabase user, call `redirect('/parse')` if `user` is truthy. The unauthenticated return renders a single `<main>` with:
- A prominent `<h1>` headline
- A `<p>` sub-headline
- An `<a href="/sign-in">` CTA button matching the existing button style (`bg-zinc-900 text-white` / dark-mode inverted)

The `signOut` import and form can be removed — authenticated users are redirected before reaching the JSX.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification

- Unauthenticated: visiting `/` shows the hero with headline, sub-headline, and sign-in button
- Authenticated: visiting `/` immediately redirects to `/parse` with no flash of landing content
- Dark mode: hero text and CTA render correctly in both light and dark themes
- Clicking "Sign in with Google" navigates to `/sign-in`

**Implementation Note:** After automated verification passes, confirm manual testing before closing.

---

## Testing Strategy

### Manual Testing Steps

1. Open an incognito window, navigate to `/` — verify hero content
2. Click sign-in CTA — verify redirect to `/sign-in`
3. Sign in, then navigate back to `/` — verify immediate redirect to `/parse`
4. Toggle system dark mode — verify text/button colours are correct in both modes

## References

- PRD: `context/foundation/prd.md`
- Current root page: `src/app/page.tsx`
- Sign-in page for CTA style reference: `src/app/sign-in/page.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Landing Hero

#### Automated

- [ ] 1.1 Linting passes: `npm run lint`
- [ ] 1.2 Build succeeds: `npm run build`

#### Manual

- [ ] 1.3 Unauthenticated: hero with headline, sub-headline, and sign-in button visible at `/`
- [ ] 1.4 Authenticated: visiting `/` redirects immediately to `/parse`
- [ ] 1.5 Dark mode: text and CTA render correctly in both light and dark themes
- [ ] 1.6 Sign-in CTA navigates to `/sign-in`
