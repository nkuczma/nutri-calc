'use client';

import { useState } from 'react';
import type { Ingredient } from '@/lib/schemas/ingredient';

interface Props {
  parsed: Ingredient[];
  onConfirm: (rows: Ingredient[]) => void;
  disabled: boolean;
}

export function IngredientEditor({ parsed, onConfirm, disabled }: Props) {
  const [rows, setRows] = useState<Ingredient[]>(parsed);

  const update = (i: number, field: keyof Ingredient, value: string | number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const remove = (i: number) =>
    setRows(prev => prev.filter((_, idx) => idx !== i));

  const add = () =>
    setRows(prev => [...prev, { name: '', quantity: 1, unit: '' }]);

  function handleConfirm() {
    const filtered = rows.filter(r => r.name.trim() !== '');
    onConfirm(filtered);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Ingredients</h2>
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
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="py-1.5 pr-2">
                <input
                  value={row.name}
                  onChange={e => update(i, 'name', e.target.value)}
                  className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </td>
              <td className="py-1.5 pr-2">
                <input
                  type="number"
                  value={row.quantity}
                  min={0}
                  onChange={e => update(i, 'quantity', Number(e.target.value))}
                  className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </td>
              <td className="py-1.5 pr-2">
                <input
                  value={row.unit}
                  onChange={e => update(i, 'unit', e.target.value)}
                  className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </td>
              <td className="py-1.5 text-center">
                <button
                  onClick={() => remove(i)}
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

      <div className="flex items-center gap-3">
        <button
          onClick={add}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          + Add ingredient
        </button>
        <button
          onClick={handleConfirm}
          disabled={disabled}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Get nutritional summary
        </button>
      </div>
    </div>
  );
}
