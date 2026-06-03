'use client';

import { deleteRecipe } from '@/app/actions/recipes';

interface Props {
  id: string;
}

export function DeleteRecipeButton({ id }: Props) {
  async function handleClick() {
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return;
    const result = await deleteRecipe(id);
    if (result?.error) alert(result.error);
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
    >
      Delete recipe
    </button>
  );
}
