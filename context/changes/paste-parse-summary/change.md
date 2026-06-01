---
change_id: paste-parse-summary
title: "S-01: paste → AI parse → editable ingredient list → nutritional summary"
status: implemented
created: 2026-05-30
updated: 2026-06-01
roadmap_id: S-01
prerequisites:
  - auth-supabase-oauth   # done
  - nutrition-data-source # done
parallel_with:
  - recipes-schema-rls
---

North star slice. User pastes raw recipe text, receives an AI-parsed editable ingredient list (name / quantity / unit), corrects any line inline, and sees the full nutritional summary with every nutrient either shown as a value or explicitly flagged missing — all under 5 seconds perceived response time.
