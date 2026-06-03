'use client';

import { useState } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { parseResultSchema, type Ingredient } from '@/lib/schemas/ingredient';
import type { IngredientNutrients } from '@/lib/nutrition';
import { IngredientEditor } from './IngredientEditor';
import { NutritionalSummary } from './NutritionalSummary';

export function ParseFlow() {
  const [text, setText] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [parseRound, setParseRound] = useState(0);
  const [fetchingNutrients, setFetchingNutrients] = useState(false);
  const [nutritionDone, setNutritionDone] = useState(false);
  const [nutritionError, setNutritionError] = useState<string | null>(null);
  const [nutrients, setNutrients] = useState<IngredientNutrients | null | undefined>(undefined);
  const [weightGrams, setWeightGrams] = useState<(number | 'missing' | null)[] | null>(null);

  const { object, submit, isLoading, error } = useObject({
    api: '/api/parse-recipe',
    schema: parseResultSchema,
  });

  const parsedIngredients: Ingredient[] = ((object?.ingredients ?? []) as Ingredient[]).filter(
    i => i?.name
  );

  const isEmpty = hasSubmitted && !isLoading && parsedIngredients.length === 0;
  const showEditor = hasSubmitted && !isLoading && parsedIngredients.length > 0;

  function handleParse() {
    setHasSubmitted(true);
    setParseRound(r => r + 1);
    setNutritionDone(false);
    setNutrients(undefined);
    setNutritionError(null);
    setWeightGrams(null);
    submit({ recipeText: text });
  }

  async function handleConfirm(rows: Ingredient[]) {
    setNutritionError(null);
    setNutrients(undefined);
    setFetchingNutrients(true);
    setNutritionDone(true);

    try {
      // Step 1: resolve gram weights
      const normalizeRes = await fetch('/api/normalize-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: rows }),
      });
      const normalizeData = await normalizeRes.json();
      if (!normalizeRes.ok) throw new Error(normalizeData.error ?? 'Unit normalization failed');
      const weights: (number | 'missing')[] = normalizeData.weights;
      setWeightGrams(weights);

      // Step 2: fetch nutrition with weights
      const res = await fetch('/api/nutrition-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: rows, weights }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Nutrition fetch failed');
      setNutrients(data.nutrients);
    } catch (err) {
      setNutritionError(err instanceof Error ? err.message : 'Nutrition fetch failed');
      setNutritionDone(false);
    } finally {
      setFetchingNutrients(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Paste recipe text
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. 2 cups flour, 1 tsp salt, 3 eggs…"
          rows={6}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          onClick={handleParse}
          disabled={isLoading || !text.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isLoading ? 'Parsing…' : 'Parse recipe'}
        </button>

        {error && (
          <p className="text-sm text-red-600">Parse error: {error.message}</p>
        )}
        {isEmpty && !error && (
          <p className="text-sm text-zinc-500">No ingredients found — try rephrasing.</p>
        )}
      </div>

      {showEditor && (
        <IngredientEditor
          key={parseRound}
          parsed={parsedIngredients}
          onConfirm={handleConfirm}
          disabled={fetchingNutrients}
          weightGrams={weightGrams}
        />
      )}

      {nutritionDone && (
        <div className="space-y-3">
          {fetchingNutrients && (
            <p className="text-sm text-zinc-500">Fetching nutritional data…</p>
          )}
          {nutritionError && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">{nutritionError}</p>
              <button
                onClick={() => setNutritionDone(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Try again
              </button>
            </div>
          )}
          {!fetchingNutrients && !nutritionError && (
            <NutritionalSummary nutrients={nutrients ?? null} />
          )}
        </div>
      )}
    </div>
  );
}
