import { vi, it, expect } from "vitest";

vi.mock("@/lib/supabase/server");

import { POST } from "@/app/api/parse-recipe/route";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

it("returns 401 when no session exists (Risk #7)", async () => {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  } as never);

  const req = new Request("http://localhost/api/parse-recipe", {
    method: "POST",
    body: JSON.stringify({ recipeText: "test" }),
    headers: { "Content-Type": "application/json" },
  });

  const response = await POST(req);

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Unauthorized" });
});
