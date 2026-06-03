import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        <main className="mx-auto max-w-xl px-4 py-16">
          <h1 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            Know what&apos;s actually in your recipes
          </h1>
          <p className="mb-8 text-base text-zinc-600 dark:text-zinc-400">
            Paste any recipe and get a full nutritional breakdown. Missing
            nutrients are flagged explicitly — never quietly treated as zero.
          </p>
          <a
            href="/sign-in"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Sign in with Google
          </a>
        </main>
      </div>
    )
  }

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          My recipes
        </h1>

        <div className="mb-8 flex gap-3">
          <Link
            href="/recipes/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            New recipe
          </Link>
          <Link
            href="/parse"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Parse with AI
          </Link>
        </div>

        {!recipes || recipes.length === 0 ? (
          <p className="text-sm text-zinc-500">No recipes yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {recipes.map(r => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="-mx-2 flex items-center justify-between rounded px-2 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">
                    {r.title}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
