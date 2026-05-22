---
project: NutriCalc
researched_at: 2026-05-22
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16 App Router
  runtime: Cloudflare Workers (via @opennextjs/cloudflare)
  database: Supabase (external)
---

## Recommendation

**Deploy on Cloudflare Workers via `@opennextjs/cloudflare`.**

Cloudflare Workers scored the maximum 10/10 across all five agent-friendly criteria and is the only platform the developer already has hands-on experience with — a tiebreaker that matters for a solo 3-week MVP. The external Supabase + OpenRouter stack removes any co-location dependency, and the free tier (100k requests/day, unlimited static assets) comfortably covers MVP-stage traffic with zero infrastructure cost. One critical correction from research: the `tech-stack.md` records `deployment_target: cloudflare-pages` and the `CLAUDE.md` references `@cloudflare/next-on-pages` — **that adapter was deprecated and archived on 2025-09-29**. The correct deployment target is **Cloudflare Workers** using **`@opennextjs/cloudflare`**, which is GA and actively maintained.

---

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent docs | Deploy API | MCP/Integration | **Total** |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **10/10** |
| **Vercel** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | **10/10** |
| **Netlify** | ⚠️ Partial | ✅ Pass | ⚠️ Partial | ✅ Pass | ✅ Pass | **8/10** |
| **Render** | ⚠️ Partial | ⚠️ Partial | ✅ Pass | ⚠️ Partial | ✅ Pass | **7/10** |
| **Fly.io** | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ✅ Pass | ⚠️ Partial | **6/10** |
| **Railway** | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | **5/10** |

**Scoring notes per criterion:**

- **CLI-first:** Cloudflare (`wrangler deploy`, `wrangler rollback`, `wrangler tail`) and Vercel (`vercel deploy --prod`, `vercel rollback`, `vercel logs`) both have complete CLI coverage for every operational task. Netlify, Render, Railway, and Fly.io all score Partial because rollback requires the dashboard or a manual API call rather than a single CLI command.
- **Managed/Serverless:** Cloudflare Workers and Vercel are fully serverless with zero OS/infra to manage. Netlify is also fully managed. Fly.io, Railway, and Render require container/process configuration (Dockerfile or `output: standalone`) and carry more operational surface area.
- **Agent-accessible docs:** Cloudflare (`llms.txt`, `Accept: text/markdown` on any page, GitHub-hosted source), Vercel (`llms-full.txt`, per-page `.md` suffix), and Render (`render.com/llms.txt`) all publish first-class agent-readable docs. Netlify and Fly.io score Partial — no `llms.txt`, HTML-rendered docs without raw GitHub source. Railway scores Partial — MDX on GitHub with `.md` URL suffix, but no `llms.txt`.
- **Stable deploy API:** Cloudflare (`wrangler deploy` with `--version-id` rollback), Vercel (`vercel deploy --prod`, rollback by deployment URL), Netlify (atomic deploys, instant API rollback), and Fly.io (`fly deploy`) all provide deterministic one-command deploys. Render and Railway score Partial because CLI rollback is unavailable (dashboard/API only, undocumented retention windows).
- **MCP/Integration:** Cloudflare (GA MCP servers, 2500+ API endpoints, direct Claude Code integration), Vercel (GA `mcp.vercel.com`, OAuth-backed), Netlify (GA `@netlify/mcp`), and Render (GA hosted MCP at `mcp.render.com`) all pass. Fly.io (Experimental) and Railway (Beta/"work in progress") score Partial.

---

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Perfect score across all five criteria. The `wrangler` CLI covers deploy, rollback, log tailing, and secret management without touching a dashboard. Docs are available as `llms.txt`, per-page markdown, and GitHub source — the most agent-readable of any platform researched. The Cloudflare MCP ecosystem (GA, 2500+ endpoints, Workers Bindings MCP, Observability MCP) is the most mature Claude Code integration of any platform in the candidate pool. The developer already has hands-on Cloudflare experience, breaking the tie with Vercel. Free tier covers the full MVP traffic budget with zero cost. **Critical migration note:** update `tech-stack.md`, `CLAUDE.md`, and any existing config from `@cloudflare/next-on-pages` (deprecated 2025-09-29) to `@opennextjs/cloudflare` targeting Cloudflare Workers, not Cloudflare Pages.

#### 2. Vercel

Tied on score (10/10) and narrowly edged out only by the developer's existing Cloudflare familiarity. Vercel is the canonical Next.js host — the framework is maintained by Vercel, so Next.js 16 App Router features work on day one with no adapter layer. The Vercel MCP server (`mcp.vercel.com`, GA) integrates directly with Claude Code via `claude mcp add --transport http vercel https://mcp.vercel.com`. The Hobby plan is free at MVP traffic volumes, though the 4 CPU-hours/month active compute cap could bind under sustained AI parsing load (OpenRouter requests running 2–5 seconds each); Pro at $20/month removes the cap and the non-commercial restriction. The primary gap versus Cloudflare: no `wrangler rollback` equivalent — Vercel rollback targets a specific deployment URL or ID rather than a named version.

#### 3. Render

Strong agent-readiness for a container-based platform: `render.com/llms.txt` and per-page markdown are first-class features, and the hosted MCP server (`mcp.render.com`, GA August 2025) covers deploy, logs, and metrics. Persistent Node.js processes mean no adapter layer and no serverless cold-start concerns. Pricing is predictable at $7/month (Starter, always-on). The main operational gap: ISR cache lives on the local filesystem and is wiped on every deploy unless a Persistent Disk is attached — for a recipe app that may use cached nutritional data lookups, this requires a config step. CLI rollback is dashboard/API only.

---

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **The adapter is a community project, not a Cloudflare-native primitive.** `@opennextjs/cloudflare` is maintained by the OpenNext community, not Cloudflare. Newer Next.js 16 App Router features — `proxy.ts` (renamed middleware), Partial Prerendering, Node Middleware — lag behind the Vercel-native implementation. A breaking Next.js minor version can leave the adapter behind for weeks, blocking feature development.

2. **Bundle size limit is a real ceiling.** Free tier: 3 MiB compressed. Paid tier: 10 MiB. Adding Supabase client, OpenRouter SDK, and UI component libraries to a Next.js App Router build can approach or exceed this limit. Hitting it mid-development requires a plan upgrade and careful tree-shaking of dependencies.

3. **`process.env` from the Wrangler dashboard requires `compatibility_date: "2025-04-01"` or later in `wrangler.jsonc`.** Without this, Supabase client initialization will silently fail because `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` won't surface as expected environment variables. Not prominently documented.

4. **Windows-native builds are not fully supported.** The Cloudflare + OpenNext build pipeline is not guaranteed on Windows; WSL is the recommended path. The project lives at `C:\Users\NataliaKuczma\Desktop\10xdevs` — every local build and `wrangler deploy` invocation will need to run inside WSL or be delegated to CI (GitHub Actions), adding a daily friction step.

5. **Next.js image optimization (`<Image>`) is not free.** Unoptimized source images are served on the Workers free/paid tier. Cloudflare Images (paid add-on, separate billing) is required for responsive resizing and WebP conversion. For a nutritional app this is low priority, but worth knowing before adding food photography.

### Pre-mortem — How This Could Fail

Six months after deploying NutriCalc to Cloudflare Workers, the team hits a wall. The first sign of trouble: the OpenRouter streaming response for AI recipe parsing drops silently after 30 seconds on the free tier, because Cloudflare Workers imposes a CPU time limit per request (10ms CPU on free, 30ms on Workers Paid). Streaming AI responses from OpenRouter that call out to a slow model exceed the CPU budget and fail without a clear error — the user sees a blank ingredient list with no error message. After upgrading to Workers Paid ($5/month), the wall-clock limit increases, but the root issue remains: any parse call that takes more than 30ms CPU to process the response fails silently.

In parallel, `@opennextjs/cloudflare` lags behind a Next.js minor version that introduced changes to the `proxy.ts` pattern used by the Supabase Auth middleware. Debugging the mismatch between the adapter version and the Supabase `@supabase/ssr` cookie handler takes three days. The documentation for this specific combination — Supabase SSR + OpenNext adapter + Cloudflare Workers runtime — is scattered across three separate docs sites with conflicting examples. The team considers migrating to Vercel, where the same Supabase Auth integration works out of the box. The assumptions that failed: "the adapter keeps up with Next.js releases" and "Workers CPU limits don't affect stateless HTTP API calls."

### Unknown Unknowns

1. **CPU time limits are distinct from wall-clock time and are not on the main pricing page.** Free: 10ms CPU per request. Paid: 30ms CPU per request. OpenRouter API calls involve JSON deserialization of potentially large AI responses — this can push CPU usage higher than expected for a "simple" HTTP call. The limit lives in the Workers limits reference doc, not the pricing overview.

2. **Supabase Auth requires `@supabase/ssr` with a Workers-specific cookie handler.** The standard `@supabase/auth-helpers-nextjs` does not work in the Workers runtime. The required `@supabase/ssr` package and its edge-compatible cookie adapter are documented in Supabase's edge runtime guide, not in Cloudflare's Next.js deployment guide — easy to miss during initial setup.

3. **`wrangler deploy` does not validate missing environment variables before deploying.** If `NEXT_PUBLIC_SUPABASE_URL` or `AI_API_KEY` are missing from the Cloudflare dashboard, the deploy succeeds and the app fails at runtime. There is no pre-deploy secret validation in the Wrangler pipeline.

4. **The `@opennextjs/cloudflare` adapter version must be pinned to match the Next.js version.** An unpinned `npm update` can break the adapter/framework pairing silently. The OpenNext changelog documents multiple breaking updates corresponding to Next.js minor releases. Neither the adapter README nor the Cloudflare deployment guide clearly warns about this coupling — pin both in `package.json`.

---

## Operational Story

- **Preview deploys:** `wrangler versions upload` creates a new version without routing traffic. `wrangler deployments list` shows pending versions. A PR-based preview URL requires either Cloudflare Pages (legacy, not the recommended Workers path) or GitHub Actions deploying to a named Workers environment (e.g., `staging`). For MVP: deploy to a `preview` environment manually via `wrangler deploy --env preview`. Preview deployments are public by default — protect with Cloudflare Access (Zero Trust) if the app is not yet public. (Access requires a Cloudflare account team domain, available on free plan.)

- **Secrets:** Runtime secrets live in the Cloudflare dashboard under Workers → Settings → Variables and Secrets (encrypted). Add via CLI: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`. Public env vars (`NEXT_PUBLIC_*`) must also be set as plain-text vars in the dashboard **and** defined in `wrangler.jsonc` under `[vars]` to surface as `process.env.*` — they are not automatically promoted from the build environment. GitHub Secrets hold CI tokens; rotate Cloudflare API tokens via `wrangler tokens list` and `wrangler tokens revoke`.

- **Rollback:** `wrangler rollback` reverts to the previous deployment. `wrangler rollback --version-id <id>` targets a specific version (list via `wrangler deployments list`). Rollback is blocked if a Durable Objects migration or binding removal occurred between versions. Typical time-to-revert: < 30 seconds globally. **DB migrations (Supabase) are not rolled back by Wrangler** — schema changes must be reversed separately in Supabase Studio or via the Supabase CLI.

- **Approval:** Human-only actions — rotating `SUPABASE_SERVICE_ROLE_KEY`, modifying DNS records, changing Cloudflare Access policies, deleting a Worker. These are dashboard-by-hand operations. Agent-permitted unattended actions — `wrangler deploy`, `wrangler rollback`, `wrangler secret put` (for non-primary secrets), `wrangler tail` (log streaming).

- **Logs:** `wrangler tail` streams live console output and exceptions per request to the terminal. Filter by outcome: `wrangler tail --format pretty --status error`. For structured log analysis: `wrangler tail --format json | jq 'select(.outcome == "exception")'`. Cloudflare Observability MCP server exposes logs as structured MCP tool calls for agent-driven querying without parsing CLI output.

---

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| OpenNext adapter lags behind Next.js minor releases, blocking features | Devil's advocate | M | M | Pin `@opennextjs/cloudflare` version in `package.json`; monitor OpenNext changelog before `npm update` |
| Workers CPU time limit (30ms) exceeded by OpenRouter response processing | Pre-mortem | M | H | Upgrade to Workers Paid ($5/month) for 30ms CPU limit; process AI response in a streaming fashion rather than buffering entire response before parsing |
| `process.env` from dashboard vars not accessible without `compatibility_date: "2025-04-01"` | Unknown unknowns | H | H | Set `compatibility_date = "2025-04-01"` in `wrangler.jsonc` on day one; document in CLAUDE.md |
| Supabase Auth middleware breaks with default `@supabase/auth-helpers-nextjs` in Workers runtime | Unknown unknowns | H | H | Use `@supabase/ssr` with Workers-compatible cookie adapter from the start; reference Supabase edge runtime guide |
| Bundle size limit (3 MiB free / 10 MiB paid) hit mid-development | Devil's advocate | M | M | Enable bundle analysis (`wrangler deploy --dry-run`); plan for Workers Paid if size exceeds free limit |
| Windows-native builds unsupported; WSL required | Devil's advocate | H | L | Configure CI (GitHub Actions on Ubuntu) as the canonical build path; use WSL for local development |
| Missing env vars not caught at deploy time | Unknown unknowns | M | H | Add a pre-deploy validation script that checks required env vars against `wrangler.jsonc` definitions before running `wrangler deploy` in CI |
| `@cloudflare/next-on-pages` still referenced in CLAUDE.md and tech-stack.md | Research finding | H | M | Update both files to reference `@opennextjs/cloudflare` and `Cloudflare Workers` before any code is written against the deployment path |
| Wrangler rollback blocked by Durable Objects migration | Research finding | L | H | Avoid Durable Objects migrations during active traffic; use named environments (`preview` / `production`) to stage migration rollout |
| Image optimization requires paid Cloudflare Images | Devil's advocate | L | L | Use Next.js `unoptimized` prop on `<Image>` components for MVP, or proxy through Cloudflare Images only for key images |

---

## Getting Started

The recommended sequence for first deploy, verified against `@opennextjs/cloudflare` (GA) and `wrangler` CLI for the exact stack in `tech-stack.md`:

1. **Install the correct adapter and CLI:**
   ```bash
   npm install @opennextjs/cloudflare@latest
   npm install --save-dev wrangler@latest
   ```
   Remove `@cloudflare/next-on-pages` if present — it is deprecated and must not be used.

2. **Create `wrangler.jsonc` in the project root:**
   ```jsonc
   {
     "name": "nutri-calc",
     "compatibility_date": "2025-04-01",
     "compatibility_flags": ["nodejs_compat"],
     "main": ".open-next/worker.js",
     "assets": {
       "directory": ".open-next/assets",
       "binding": "ASSETS"
     }
   }
   ```
   The `compatibility_date` of `2025-04-01` is required for `process.env` to surface Cloudflare dashboard vars.

3. **Add build and deploy scripts to `package.json`:**
   ```json
   "scripts": {
     "build:worker": "opennextjs-cloudflare build",
     "deploy": "opennextjs-cloudflare build && wrangler deploy",
     "preview": "opennextjs-cloudflare build && wrangler dev"
   }
   ```

4. **Set secrets in the Cloudflare dashboard (Workers → nutri-calc → Settings → Variables):**
   - `NEXT_PUBLIC_SUPABASE_URL` — plain text
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — plain text
   - `AI_API_KEY` — encrypted secret (for OpenRouter)
   - `SUPABASE_SERVICE_ROLE_KEY` — encrypted secret
   Or via CLI: `wrangler secret put AI_API_KEY`

5. **First deploy:**
   ```bash
   npm run deploy
   ```
   This builds the Next.js app with the OpenNext Cloudflare adapter and deploys to Cloudflare Workers. The output URL is printed on success. Verify with `wrangler deployments list`.

---

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions for automated deploy on merge — referenced in `tech-stack.md` as `ci_provider: github-actions`)
- Production-scale architecture (multi-region, HA, DR)
- Cloudflare Access configuration for preview URL protection
