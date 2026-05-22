# Deploy Plan: NutriCalc → Cloudflare Workers (First Deploy)

## Context

The project is a bare Next.js 16 scaffold. No app-specific code exists yet, so this is a **smoke deploy** — its sole purpose is to prove the deployment pipeline works end-to-end before feature development begins. The platform decision (Cloudflare Workers via `@opennextjs/cloudflare`) is locked in `context/foundation/infrastructure.md`. Two config files currently reference the deprecated `@cloudflare/next-on-pages` adapter; those must be corrected before any deployment code is written.

Because the project lives on Windows (`C:\Users\NataliaKuczma\Desktop\10xdevs`) and Windows-native Cloudflare builds are unsupported, **GitHub Actions on Ubuntu is the canonical build + deploy path**. No local build or `wrangler deploy` invocation is needed on the developer's machine.

---

## Steps

### Phase 0 — Pre-flight corrections
These fix stale references that would mislead future agents or CI tooling.

1. **`context/foundation/tech-stack.md` line 8** — change `deployment_target: cloudflare-pages` → `deployment_target: cloudflare-workers`
2. **`CLAUDE.md` deployment line** — replace `Cloudflare Pages via \`@cloudflare/next-on-pages\`` with `Cloudflare Workers via \`@opennextjs/cloudflare\``

---

### Phase 1 — Install adapter + CLI

Add to `package.json` (agent runs `npm install` commands; npm writes the exact resolved versions):

```bash
npm install @opennextjs/cloudflare@latest
npm install --save-dev wrangler@latest
```

---

### Phase 2 — Configure adapter

**Create `wrangler.jsonc`** at project root (verbatim from `infrastructure.md` Getting Started):

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

`compatibility_date: "2025-04-01"` is required — without it `process.env` variables set in the Cloudflare dashboard are silently inaccessible.

**Update `package.json` scripts** — add three entries alongside existing scripts:

```json
"build:worker": "opennextjs-cloudflare build",
"deploy": "opennextjs-cloudflare build && wrangler deploy",
"preview": "opennextjs-cloudflare build && wrangler dev"
```

**Update `.gitignore`** — append `.open-next/` (the build output directory, must not be committed).

---

### Phase 3 — GitHub Actions CI/CD

Create **`.github/workflows/deploy.yml`**:

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build:worker
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

### Phase 4 — Manual gate (human steps before first push)

The agent cannot do these. Complete them before merging/pushing to `main`:

1. **Log into Cloudflare dashboard** → Workers & Pages → confirm the `nutri-calc` Worker will be created on first deploy (no pre-creation needed; `wrangler deploy` creates it).
2. **Generate a scoped API token**: Cloudflare dashboard → My Profile → API Tokens → Create Token → use "Edit Cloudflare Workers" template → scope to Account: `<your account>`, Zone Resources: none. Copy the token.
3. **Add GitHub secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `CLOUDFLARE_API_TOKEN` — the scoped token from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID (found in dashboard right sidebar under any domain, or via `wrangler whoami` in WSL)

> Note: App env vars (`NEXT_PUBLIC_SUPABASE_URL`, `AI_API_KEY`, etc.) are **not needed for this smoke deploy** — the scaffold has no Supabase or AI code. Add them via `wrangler secret put` or the Cloudflare dashboard when those features are implemented.

---

### Phase 5 — First deploy

Push the changes from Phases 0–3 to `main`. GitHub Actions fires automatically. On success:

- Actions log prints the Workers URL: `https://nutri-calc.<subdomain>.workers.dev`
- Verify with `wrangler deployments list` (requires local `wrangler login` or `CLOUDFLARE_API_TOKEN` env var in WSL)

---

## Critical files

| File | Action |
|---|---|
| `context/foundation/tech-stack.md` | Fix `deployment_target` value |
| `CLAUDE.md` | Fix adapter reference |
| `package.json` | Add `@opennextjs/cloudflare`, `wrangler`, and three scripts |
| `wrangler.jsonc` | Create (new) |
| `.gitignore` | Append `.open-next/` |
| `.github/workflows/deploy.yml` | Create (new) |

`next.config.ts` does **not** need changes — the existing Turbopack dev config is inert during `next build`, and `@opennextjs/cloudflare` does not require config modifications for a basic scaffold.

---

## Verification

1. GitHub Actions run completes with green status.
2. Visiting the Workers URL returns the Next.js default page (no 5xx, no blank page).
3. `wrangler deployments list` (in WSL or CI) shows one deployment entry for `nutri-calc`.

---

## Risks carried forward

From the risk register in `infrastructure.md`:

| Risk | Status after this plan |
|---|---|
| Windows build unsupported | Mitigated — CI on Ubuntu is the sole build path |
| `compatibility_date` missing | Mitigated — set in `wrangler.jsonc` |
| Missing env vars not caught at deploy | Accepted for smoke deploy (no secrets needed yet); add pre-deploy check when first secret is wired |
| OpenNext adapter version pinning | Deferred — pin after first successful deploy once exact version is resolved by `npm install` |
