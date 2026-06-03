'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Ingredient } from '@/lib/schemas/ingredient';
import type { IngredientNutrients } from '@/lib/nutrition';
import { IngredientEditor } from '@/app/parse/IngredientEditor';
import { NutritionalSummary } from '@/app/parse/NutritionalSummary';
import { saveRecipe } from '@/app/actions/recipes';

export function ManualEntryFlow() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [confirmedRows, setConfirmedRows] = useState<Ingredient[] | null>(null);
  const [weightGrams, setWeightGrams] = useState<(number | 'missing' | null)[] | null>(null);
  const [nutrients, setNutrients] = useState<IngredientNutrients | null | undefined>(undefined);
  const [perIngredientNutrients, setPerIngredientNutrients] = useState<(IngredientNutrients | null)[] | null>(null);
  const [fetchingNutrients, setFetchingNutrients] = useState(false);
  const [nutritionError, setNutritionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleConfirm(rows: Ingredient[]) {
    setNutritionError(null);
    setNutrients(undefined);
    setFetchingNutrients(true);

    try {
      const normalizeRes = await fetch('/api/normalize-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: rows }),
      });
      const normalizeData = await normalizeRes.json();
      if (!normalizeRes.ok) throw new Error(normalizeData.error ?? 'Unit normalization failed');
      const weights: (number | 'missing')[] = normalizeData.weights;
      setWeightGrams(weights);

      const res = await fetch('/api/nutrition-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: rows, weights }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Nutrition fetch failed');

      setNutrients(data.nutrients);
      setPerIngredientNutrients(data.perIngredient ?? null);
      setConfirmedRows(rows);
    } catch (err) {
      setNutritionError(err instanceof Error ? err.message : 'Nutrition fetch failed');
    } finally {
      setFetchingNutrients(false);
    }
  }

  async function handleSave() {
    if (!title.trim() || !nutrients || saving) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveRecipe(
      title.trim(),
      confirmedRows ?? [],
      perIngredientNutrients ?? [],
      nutrients ?? null,
    );
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
    } else {
      router.push('/recipes');
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <label
          htmlFor="recipe-title"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Recipe title
        </label>
        <input
          id="recipe-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Pasta primavera"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <IngredientEditor
        parsed={[{ name: '', quantity: 1, unit: '' }]}
        onConfirm={handleConfirm}
        disabled={fetchingNutrients}
        weightGrams={weightGrams}
      />

      {fetchingNutrients && (
        <p className="text-sm text-zinc-500">Fetching nutritional data…</p>
      )}

      {nutritionError && (
        <p className="text-sm text-red-600">{nutritionError}</p>
      )}

      {nutrients !== undefined && !fetchingNutrients && !nutritionError && (
        <div className="space-y-4">
          <NutritionalSummary nutrients={nutrients ?? null} />

          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? 'Saving…' : 'Save recipe'}
            </button>
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
