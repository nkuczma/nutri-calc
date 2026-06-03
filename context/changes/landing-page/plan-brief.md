# Landing Page — Plan Brief

> Full plan: `context/changes/landing-page/plan.md`

## What & Why

Replace the sparse root page at `/` with a hero landing page that converts first-time visitors into sign-ups. The current page has no value proposition — just a heading and a one-liner. The PRD's core differentiator (transparent missing-data flags, never silent zeros) deserves a proper first impression.

## Starting Point

`src/app/page.tsx` is a 57-line async Server Component that conditionally renders a minimal auth gate. Unauthenticated visitors see "Parse recipes and track nutrients." and a sign-in button — no headline, no differentiator callout.

## Desired End State

Unauthenticated visitors see a hero with a clear headline ("Know what's actually in your recipes"), a sub-headline surfacing the missing-data differentiator, and a sign-in CTA. Authenticated users are server-side redirected to `/parse` immediately — they never see the landing content.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Page goal | Convert visitors to sign-ups | Directly serves PRD's primary persona; explanation is secondary |
| Route | Replace `/` (root page) | Standard SaaS pattern; no extra routing needed |
| Sections | Hero only | Keeps scope tight for MVP; no how-it-works section |
| Visual style | Extend existing zinc/Tailwind | Zero design work; consistent with rest of app |
| Auth handling | Server-side redirect to `/parse` | No flash of landing content; cleanest UX |

## Scope

**In scope:** Rewrite `src/app/page.tsx` — hero headline, sub-headline, sign-in CTA, redirect for authenticated users.

**Out of scope:** How-it-works section, footer, new colors, animations, analytics, changes to any other page.

## Architecture / Approach

Single-file change. The component remains an async Server Component. After the Supabase auth check, `redirect('/parse')` fires for authenticated users. Unauthenticated users see the hero layout. The `signOut` import and action form are removed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Landing Hero | Hero page live at `/`; auth redirect in place | Copy quality — headline must be sharp enough to convert |

**Prerequisites:** None — the project builds and deploys today.  
**Estimated effort:** ~1 session, single-phase.

## Open Risks & Assumptions

- Headline copy ("Know what's actually in your recipes") is a planning-time decision — can be tweaked during implementation without replanning.
- The Supabase server client import pattern is assumed to match `src/app/parse/page.tsx`; verify before writing.

## Success Criteria (Summary)

- Unauthenticated visitors see a hero with value proposition at `/`
- Authenticated users land on `/parse` with no flash of landing content
- Build and lint pass; dark mode renders correctly
