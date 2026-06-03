import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recipeRowToTotals, ingredientRowToNutrients } from '@/lib/db/recipes';
import { DeleteRecipeButton } from './DeleteRecipeButton';
import { RecipeDetailView } from './RecipeDetailView';

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

  const { data: ingredientRows } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', id)
    .order('id');

  const totals = recipeRowToTotals(recipe);
  const ingredients = (ingredientRows ?? []).map(row => ({
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    nutrients: ingredientRowToNutrients(row),
  }));

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

        <RecipeDetailView
          recipe={{ id, title: recipe.title, totals }}
          ingredients={ingredients}
        />
      </main>
    </div>
  );
}
