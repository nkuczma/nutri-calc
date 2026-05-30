# LLM API Review — paste-parse-summary

Research date: 2026-05-30  
Scope: AI parsing libraries compatible with Next.js 16 App Router + Cloudflare Workers (`@opennextjs/cloudflare`).

---

## Sub-problems in paste-parse-summary

1. **AI parsing** — LLM SDK that calls an external model and returns a structured ingredient list (name / quantity / unit)
2. **Structured output** — schema-validated JSON response, no hallucinated fields
3. **Inline editable ingredient list** — UI for correcting the parsed result before the nutrition lookup

---

## SDK options

### Option A — Vercel AI SDK v6 + `@ai-sdk/anthropic` (recommended)

```
npm install ai @ai-sdk/anthropic zod
```

- Full Cloudflare Workers support as of AI SDK v6 (Dec 2025)
- Structured output: `streamText` + `Output.object({ schema: z.object({...}) })` — Zod schema, fully typed
- `useObject` hook for progressive client-side rendering
- CPU-time concern (roadmap S-01 unknown): streaming transfers work to wall time (unlimited for HTTP on Workers paid); CPU time only ticks while JS executes, not while waiting on the LLM stream
- **Caveat**: `streamObject` smooth-streaming has a RegExp/CPU bug ([vercel/ai#6492](https://github.com/vercel/ai/issues/6492)); use `streamText` + `Output.object()` instead (the recommended AI SDK v6 pattern anyway)
- Model-swappable: replace `@ai-sdk/anthropic` with `@ai-sdk/openai` (→ OpenRouter) in one line

### Option B — `@ai-sdk/openai` → OpenRouter

```
npm install ai @ai-sdk/openai zod
```

```ts
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})
```

- Same AI SDK surface, pointed at OpenRouter's OpenAI-compatible endpoint
- Access to Claude, GPT-4o, Gemini, Llama via one API key and one env var swap
- OpenRouter supports `response_format: json_schema` + streaming structured outputs natively
- Free tier available (rate-limited free models: Llama 3.3 70B, Gemma 3, Mistral — not Claude/GPT-4o)

### Option C — `@anthropic-ai/sdk` directly

```
npm install @anthropic-ai/sdk zod
```

- Officially supports Cloudflare Workers runtime
- Native structured output: `output_config.format` with `zodOutputFormat()` helper (GA Feb 2026, all Sonnet/Haiku/Opus 4.x)
- More control, less abstraction
- No `useObject` streaming hook; stream must be accumulated manually
- Ties codebase to Anthropic only — harder to swap models

### Option D — Cloudflare Workers AI (`workers-ai-provider`)

```
npm install ai workers-ai-provider zod
```

- Uses Cloudflare's own hosted models (Llama 3.x, Kimi K2.5, etc.) via `env.AI` binding
- No external API key, no billing on free plan (10k neurons/day)
- Structured output: `Output.object()` supported on select models
- Tradeoff: model quality lower than Claude Haiku for ingredient extraction; free tier model availability can change

---

## Cost comparison

| Path | SDK cost | API cost |
|---|---|---|
| AI SDK + Anthropic Haiku 4.5 | free | ~$0.001/parse ($0.80/MTok in, $4/MTok out) |
| AI SDK + OpenRouter free models | free | $0 (rate-limited) |
| Anthropic SDK directly | free | same as above |
| Cloudflare Workers AI | free | $0 (free tier: 10k neurons/day) |

For a solo 3-week MVP the Anthropic Haiku 4.5 spend is negligible (cents total). If zero spend is required, Cloudflare Workers AI is the cleanest path given CF infrastructure is already wired.

---

## Schema validation

**`zod`** — only real choice. Already the standard pairing for AI SDK structured output. Zero Node.js deps, works in all runtimes.

---

## Inline editable ingredient list — UI options

No component library is wired (confirmed in baseline). Options in ascending complexity:

| Option | Library | Effort | CF-safe |
|---|---|---|---|
| Plain React `useState` + Tailwind | none | low | yes |
| React Hook Form + Zod | `react-hook-form` + `@hookform/resolvers` | medium | yes |
| shadcn/ui inline-edit table | `shadcn/ui` | medium-high | yes |

Plain React + Tailwind is the right call for S-01 given `main_goal: speed` and solo dev. `react-hook-form` is worth adding if per-field validation (e.g. quantity > 0) becomes a pain point.

---

## Decision matrix

| Layer | Recommended | Alternative |
|---|---|---|
| LLM SDK | `ai` v6 + `@ai-sdk/anthropic` | `ai` v6 + `@ai-sdk/openai` → OpenRouter |
| Structured output pattern | `streamText` + `Output.object()` + Zod | Anthropic SDK `zodOutputFormat()` directly |
| Streaming client hook | `useObject` from `ai` | manual SSE accumulation |
| Editable ingredient list | plain React `useState` + Tailwind | `react-hook-form` if field validation needed |
| Zero-cost alternative | `workers-ai-provider` (Cloudflare Workers AI) | OpenRouter free tier |

---

## Key constraints confirmed

- `nodejs_compat` flag must be set in `wrangler.jsonc` for `@anthropic-ai/sdk` and `ai` to work on Workers
- Use `streamText` + `Output.object()`, not `streamObject` with smooth streaming (CPU RegExp bug)
- Wall time for HTTP requests on Workers is unlimited while the client stays connected — streaming is safe
- CPU time default is 30s on paid plan (can raise to 5 min in dashboard); LLM network wait does not count toward CPU
