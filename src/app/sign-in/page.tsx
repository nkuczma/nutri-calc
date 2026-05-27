import { signIn } from '@/app/actions/auth'

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'Could not start sign-in with Google. Please try again.',
  callback_failed: 'Sign-in could not be completed. Please try again.',
}

interface SignInPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? 'Sign-in failed, please try again.')
    : null

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          NutriCalc
        </h1>

        {errorMessage && (
          <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {errorMessage}
          </p>
        )}

        <form action={signIn}>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Sign in with Google
          </button>
        </form>
      </main>
    </div>
  )
}
