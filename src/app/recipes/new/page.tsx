import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ManualEntryFlow } from './ManualEntryFlow';

export default async function NewRecipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-xl px-4 py-16">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← My recipes
        </Link>
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          New recipe
        </h1>
        <ManualEntryFlow />
      </main>
    </div>
  );
}
