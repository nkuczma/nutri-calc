import { ParseFlow } from './ParseFlow';

export default function ParsePage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Parse a recipe
        </h1>
        <ParseFlow />
      </main>
    </div>
  );
}
