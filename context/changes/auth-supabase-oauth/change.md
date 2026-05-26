---
change_id: auth-supabase-oauth
title: Wire Supabase OAuth (Google / GitHub) for Workers runtime
status: implementing
created: 2026-05-26
updated: 2026-05-26
archived_at: null
---

## Notes

Roadmap item **F-01** from `context/foundation/roadmap.md` — foundation slice, status `ready`, no prerequisites.

**Outcome:** OAuth sign-in via Google / GitHub landed; session issued and verified in the Workers runtime; route protection middleware in place; `auth.uid()` available for RLS downstream.

**PRD refs:** FR-001, NFR data isolation, Access Control section.

**Unlocks:** S-01 (north star), S-02, S-03, S-04, S-05, S-06; also enables RLS policies authored in F-03.

**Key risk (per roadmap + `context/foundation/infrastructure.md`):** Supabase Auth in the Workers runtime requires `@supabase/ssr` with an edge-compatible cookie handler. The default `@supabase/auth-helpers-nextjs` will silently fail on Cloudflare Workers — wrong package choice burns days debugging cookie/session round-trips.

**Baseline (from roadmap §Baseline):** `@supabase/supabase-js` is installed and `src/lib/supabase.ts` exists; `@supabase/ssr` is NOT yet installed; no OAuth flow, no callback route, no middleware, no sign-in UI.
