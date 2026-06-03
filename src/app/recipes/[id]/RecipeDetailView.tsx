'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NutritionalSummary } from '@/app/parse/NutritionalSummary';
import { updateRecipe } from '@/app/actions/recipes';
import type { IngredientNutrients } from '@/lib/nutrition';
import type { Ingredient } from '@/lib/schemas/ingredient';

interface IngredientWithNutrients {
  name: string;
  quantity: number;
  unit: string;
  nutrients: IngredientNutrients;
}

interface Props {
  recipe: {
    id: string;
    title: string;
    totals: IngredientNutrients;
  };
  ingredients: IngredientWithNutrients[];
}

export function RecipeDetailView({ recipe, ingredients }: Props) {
  const router = useRouter();

  const [editMode, setEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState(recipe.title);
  const [editedRows, setEditedRows] = useState<Ingredient[]>(
    ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit }))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleEdit() {
    setEditedTitle(recipe.title);
    setEditedRows(ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })));
    setSaveError(null);
    setEditMode(true);
  }

  function handleCancel() {
    setEditMode(false);
    setSaveError(null);
  }

  function updateRow(i: number, field: keyof Ingredient, value: string | number) {
    setEditedRows(prev =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    );
  }

  function removeRow(i: number) {
    setEditedRows(prev => prev.filter((_, idx) => idx !== i));
  }

  function addRow() {
    setEditedRows(prev => [...prev, { name: '', quantity: 1, unit: '' }]);
  }

  async function handleSave() {
    const filtered = editedRows.filter(r => r.name.trim() !== '');
    if (filtered.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const result = await updateRecipe(recipe.id, editedTitle.trim() || recipe.title, filtered);
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setEditMode(false);
    router.refresh();
  }

  if (!editMode) {
    return (
      <>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {recipe.title}
          </h1>
          <button
            onClick={handleEdit}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Edit
          </button>
        </div>

        {ingredients.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Ingredients
            </h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {ingredients.map((ing, i) => {
                const kcal = ing.nutrients.energy;
                return (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {`${ing.quantity} ${ing.unit} `.trimEnd()}{ing.name}
                    </span>
                    <span className="text-zinc-500">
                      {kcal === 'missing' ? '—' : `${kcal.toFixed(0)} kcal`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {Object.values(recipe.totals).some(v => v !== 'missing') && (
          <section>
            <NutritionalSummary nutrients={recipe.totals} />
          </section>
        )}
      </>
    );
  }

  // Edit mode
  return (
    <>
      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title
        </label>
        <input
          value={editedTitle}
          onChange={e => setEditedTitle(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Ingredients</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Ingredient</th>
              <th className="pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400 w-20">Qty</th>
              <th className="pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400 w-20">Unit</th>
              <th className="pb-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {editedRows.map((row, i) => (
              <tr key={i}>
                <td className="py-1.5 pr-2">
                  <input
                    value={row.name}
                    onChange={e => updateRow(i, 'name', e.target.value)}
                    className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    value={row.quantity}
                    min={0}
                    onChange={e => updateRow(i, 'quantity', Number(e.target.value))}
                    className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    value={row.unit}
                    onChange={e => updateRow(i, 'unit', e.target.value)}
                    className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </td>
                <td className="py-1.5 text-center">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={addRow}
          className="mt-3 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          + Add ingredient
        </button>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>

      {saveError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{saveError}</p>
      )}
    </>
  );
}
