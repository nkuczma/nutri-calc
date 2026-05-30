# Implementation Docs — paste-parse-summary

Fetched: 2026-05-30  
Sources: Context7 (Vercel AI SDK `/vercel/ai`, AI SDK UI `/websites/ai-sdk_dev`, Zod v4 `/websites/zod_dev_v4`)

---

## 1. Install

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/react zod
```

---

## 2. Zod schema — ingredient list

```typescript
// src/lib/schemas/ingredient.ts
import { z } from 'zod';

export const ingredientSchema = z.object({
  name: z.string().describe('Ingredient name, e.g. "chicken breast"'),
  quantity: z.number().describe('Numeric amount, e.g. 2'),
  unit: z.string().describe('Unit of measure, e.g. "cups", "g", "tbsp"'),
});

export const parseResultSchema = z.object({
  ingredients: z.array(ingredientSchema),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;
```

Zod v4 note: use `import * as z from 'zod'` or `import { z } from 'zod'` — both work in v4. `z.toJSONSchema(schema)` is available in v4 if you ever need the raw JSON Schema.

---

## 3. Server — API route (Next.js App Router)

```typescript
// src/app/api/parse-recipe/route.ts
import { streamText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { parseResultSchema } from '@/lib/schemas/ingredient';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { recipeText } = await req.json();

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    output: Output.object({ schema: parseResultSchema }),
    system: `You are a recipe parser. Extract every ingredient from the recipe text.
Return only ingredients explicitly stated. Never invent quantities — if a quantity is missing use 1.
Return unit as empty string "" if not stated.`,
    prompt: recipeText,
  });

  return result.toTextStreamResponse();
}
```

Key points:
- `streamText` + `Output.object()` is the v6 pattern — avoids the smooth-streaming RegExp/CPU bug in `streamObject`
- `result.toTextStreamResponse()` returns the stream directly — no extra wrapper needed
- `export const maxDuration = 30` sets the Vercel/Workers function timeout

---

## 4. Client — streaming with `useObject`

```typescript
// src/app/parse/page.tsx  (or a Client Component within the page)
'use client';

import { useObject } from '@ai-sdk/react';
import { parseResultSchema } from '@/lib/schemas/ingredient';
import { useState } from 'react';

export default function ParsePage() {
  const [text, setText] = useState('');

  const { object, submit, isLoading, stop } = useObject({
    api: '/api/parse-recipe',
    schema: parseResultSchema,
  });

  return (
    <div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste recipe text here…"
        rows={8}
      />

      <button onClick={() => submit(JSON.stringify({ recipeText: text }))} disabled={isLoading}>
        {isLoading ? 'Parsing…' : 'Parse recipe'}
      </button>

      {isLoading && (
        <button onClick={stop}>Stop</button>
      )}

      {object?.ingredients?.map((ingredient, i) => (
        <div key={i}>
          <span>{ingredient?.name}</span>
          <span>{ingredient?.quantity}</span>
          <span>{ingredient?.unit}</span>
        </div>
      ))}
    </div>
  );
}
```

`useObject` streams partial objects — fields arrive as `undefined` until the model emits them, so always use optional chaining (`ingredient?.name`).

Available from `useObject`:
| Property | Type | Description |
|---|---|---|
| `object` | `Partial<ParseResult> \| undefined` | partial object as it streams in |
| `submit(body)` | `(body: unknown) => void` | triggers the POST |
| `isLoading` | `boolean` | true while streaming |
| `stop()` | `() => void` | cancel mid-stream |
| `error` | `Error \| undefined` | set if the request fails |

---

## 5. Inline editable ingredient list (plain React + Tailwind)

After parse completes, copy `object.ingredients` into local state for editing:

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { Ingredient } from '@/lib/schemas/ingredient';

interface Props {
  parsed: Ingredient[];
  onConfirm: (ingredients: Ingredient[]) => void;
}

export function IngredientEditor({ parsed, onConfirm }: Props) {
  const [rows, setRows] = useState<Ingredient[]>(parsed);

  useEffect(() => { setRows(parsed); }, [parsed]);

  const update = (i: number, field: keyof Ingredient, value: string | number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const remove = (i: number) =>
    setRows(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Ingredient</th><th>Quantity</th><th>Unit</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <input value={row.name} onChange={e => update(i, 'name', e.target.value)} />
              </td>
              <td>
                <input type="number" value={row.quantity} onChange={e => update(i, 'quantity', Number(e.target.value))} />
              </td>
              <td>
                <input value={row.unit} onChange={e => update(i, 'unit', e.target.value)} />
              </td>
              <td>
                <button onClick={() => remove(i)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={() => onConfirm(rows)}>
        Get nutritional summary
      </button>
    </div>
  );
}
```

---

## 6. Anthropic provider setup

```typescript
// The @ai-sdk/anthropic package auto-reads ANTHROPIC_API_KEY from env.
// No explicit client construction needed for basic use:
import { anthropic } from '@ai-sdk/anthropic';
const model = anthropic('claude-haiku-4-5');

// For explicit key / custom config:
import { createAnthropic } from '@ai-sdk/anthropic';
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

Add to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 7. Cloudflare Workers constraints

- `nodejs_compat` flag must be set in `wrangler.jsonc` (already required by `@opennextjs/cloudflare`)
- `export const maxDuration = 30` on the route handler sets the soft timeout — Workers paid plan CPU limit is 30s default (extendable to 5 min)
- Wall time for streaming HTTP responses is **unlimited** while the client stays connected — the LLM stream wait does NOT consume CPU time
- Do **not** use `streamObject` (smooth streaming mode) — known RegExp CPU spike ([vercel/ai#6492](https://github.com/vercel/ai/issues/6492)); use `streamText + Output.object()` instead

---

## 8. Zero-cost alternative (Cloudflare Workers AI)

If no API spend is acceptable, swap the model:

```typescript
import { createWorkersAI } from 'workers-ai-provider';

// In a Workers context with env.AI binding:
const workersai = createWorkersAI({ binding: env.AI });

const result = streamText({        // or generateText for non-streaming
  model: workersai('@cf/meta/llama-3.1-8b-instruct'),
  output: Output.object({ schema: parseResultSchema }),
  prompt: recipeText,
});
```

Tradeoff: Llama 3.1 8B ingredient extraction quality is lower than Claude Haiku 4.5. Free tier: 10k neurons/day.
