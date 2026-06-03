import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/parse')

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
