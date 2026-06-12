import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server");

import { deleteRecipe } from "@/app/actions/recipes";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

describe("deleteRecipe — cross-user isolation (Risk #4)", () => {
  let fromSpy: ReturnType<typeof vi.fn>;
  let eqSpy: ReturnType<typeof vi.fn>;
  let getUserMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eqSpy = vi.fn();
    // Each .eq() call returns an object that is also thenable and has another .eq()
    const queryChain: Record<string, unknown> = {
      eq: eqSpy,
      then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
    };
    eqSpy.mockReturnValue(queryChain);

    fromSpy = vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqSpy }) });
    getUserMock = vi.fn();

    mockCreateClient.mockResolvedValue({
      auth: { getUser: getUserMock },
      from: fromSpy,
    } as never);
  });

  it("returns { error: 'Unauthorized' } when no session exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await deleteRecipe("any-id");

    expect(result).toEqual({ error: "Unauthorized" });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("applies the authenticated user's id as user_id filter on the delete query", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-a" } } });

    await deleteRecipe("recipe-owned-by-user-b");

    // First .eq("id", recipeId), second .eq("user_id", authenticatedUserId)
    expect(eqSpy).toHaveBeenCalledWith("user_id", "user-a");
  });
});
