import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recipeRowToTotals, ingredientRowToNutrients } from '@/lib/db/recipes';
import { NutritionalSummary } from '@/app/parse/NutritionalSummary';
import { DeleteRecipeButton } from './DeleteRecipeButton';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: recipe } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!recipe) notFound();

  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', id)
    .order('id');

  const totals = recipeRowToTotals(recipe);
  const hasAnyTotal = Object.values(totals).some(v => v !== 'missing');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-xl px-4 py-16">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/recipes"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← My recipes
          </Link>
          <DeleteRecipeButton id={id} />
        </div>

        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {recipe.title}
        </h1>

        {ingredients && ingredients.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Ingredients
            </h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {ingredients.map(ing => {
                const nutrients = ingredientRowToNutrients(ing);
                const kcal = nutrients.energy;
                return (
                  <li key={ing.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {ing.quantity != null ? `${ing.quantity} ${ing.unit ?? ''} `.trimEnd() : ''}
                      {ing.name}
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

        {hasAnyTotal && (
          <section>
            <NutritionalSummary nutrients={totals} />
          </section>
        )}
      </main>
    </div>
  );
}
