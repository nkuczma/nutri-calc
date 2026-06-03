import type { IngredientNutrients } from '@/lib/nutrition';

const NUTRIENTS: Array<{ key: keyof IngredientNutrients; label: string; unit: string }> = [
  { key: 'energy',       label: 'Energy',          unit: 'kcal' },
  { key: 'protein',      label: 'Protein',         unit: 'g'    },
  { key: 'fat',          label: 'Fat',             unit: 'g'    },
  { key: 'saturatedFat', label: 'Saturated Fat',   unit: 'g'    },
  { key: 'carbs',        label: 'Carbohydrates',   unit: 'g'    },
  { key: 'fiber',        label: 'Fiber',           unit: 'g'    },
  { key: 'sugars',       label: 'Sugars',          unit: 'g'    },
  { key: 'salt',         label: 'Salt',            unit: 'g'    },
  { key: 'sodium',       label: 'Sodium',          unit: 'mg'   },
];

interface Props {
  nutrients: IngredientNutrients | null;
}

export function NutritionalSummary({ nutrients }: Props) {
  if (!nutrients) {
    return <p className="text-sm text-zinc-500">No ingredients to summarize.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Nutritional summary</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400">Nutrient</th>
            <th className="pb-2 text-right font-medium text-zinc-600 dark:text-zinc-400">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {NUTRIENTS.map(({ key, label, unit }) => {
            const value = nutrients[key];
            return (
              <tr key={key}>
                <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{label}</td>
                <td className="py-1.5 text-right">
                  {value === 'missing' ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {typeof value === 'number' ? value.toFixed(1) : value} {unit}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
