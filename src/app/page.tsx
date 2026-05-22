import { supabase } from "@/lib/supabase";
import MessageForm from "@/components/MessageForm";

type Message = {
  id: string;
  content: string;
  created_at: string;
};

export default async function Home() {
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-8 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Messages
        </h1>

        <div className="mb-6">
          <MessageForm />
        </div>

        <ul className="space-y-2">
          {(messages as Message[] | null)?.map((msg) => (
            <li
              key={msg.id}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {msg.content}
            </li>
          ))}
          {(!messages || messages.length === 0) && (
            <li className="text-sm text-zinc-400">No messages yet.</li>
          )}
        </ul>
      </main>
    </div>
  );
}
