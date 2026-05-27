import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ content: content.trim() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
