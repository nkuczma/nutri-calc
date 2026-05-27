---
change_id: auth-supabase-oauth
roadmap_id: F-01
title: Wire Supabase OAuth (Google) for Workers runtime
status: impl_reviewed
created: 2026-05-27
updated: 2026-05-27
---

## Summary

Wire Google OAuth sign-in via Supabase using `@supabase/ssr` (cookie-based, edge-compatible sessions). Delivers the auth scaffold that unlocks every signed-in slice downstream (S-01, S-02, S-03, S-04, S-05, S-06).

## PRD refs

FR-001, NFR data isolation, Access Control section

## Unlocks

F-03, S-01, S-02, S-03, S-04, S-05, S-06
