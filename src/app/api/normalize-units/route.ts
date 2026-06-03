import { createClient } from "@/lib/supabase/server";
import type { Ingredient } from "@/lib/schemas/ingredient";
import { convertToGrams } from "@/lib/unit-conversion";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { ingredients }: { ingredients: Ingredient[] } = await req.json();

  const weights = await Promise.all(
    ingredients.map((i) => convertToGrams(i.name, i.quantity, i.unit)),
  );

  return Response.json({ weights });
}
