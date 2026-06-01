import { streamObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createClient } from "@/lib/supabase/server";
import { parseResultSchema } from "@/lib/schemas/ingredient";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { recipeText } = await req.json();

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const result = streamObject({
    model: openrouter("anthropic/claude-sonnet-4.6"),
    schema: parseResultSchema,
    system: `You are a recipe parser. Extract every ingredient explicitly stated in the recipe text.
Never invent ingredients. Never invent quantities — if a quantity is missing, default to 1.
Set unit to empty string "" if no unit is stated.
Convert all fractions (Unicode like ½ ¼ ⅓, or written like 1/2 3/4) to decimal numbers. Try to strip to pure ingredients - for example large egg make into egg`,
    prompt: recipeText,
  });

  return result.toTextStreamResponse();
}
