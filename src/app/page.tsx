import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          NutriCalc
        </h1>

        {user ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {user.email}
              </span>
            </p>
            <Link
              href="/parse"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Parse a recipe
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Parse recipes and track nutrients.
            </p>
            <a
              href="/sign-in"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Sign in with Google
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
