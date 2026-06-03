-- Add updated_at tracking to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Atomic update RPC: verify ownership, replace all ingredient rows, update recipe totals
CREATE OR REPLACE FUNCTION public.update_recipe(
  p_user_id     uuid,
  p_recipe_id   uuid,
  p_title       text,
  p_totals      jsonb,
  p_ingredients jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ownership guard: raise if recipe does not belong to p_user_id
  IF NOT EXISTS (
    SELECT 1 FROM recipes WHERE id = p_recipe_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Recipe not found or access denied';
  END IF;

  -- Update recipe title, nutrient totals, and updated_at timestamp
  UPDATE recipes SET
    title               = p_title,
    total_energy        = (p_totals->>'total_energy')::numeric,
    total_protein       = (p_totals->>'total_protein')::numeric,
    total_fat           = (p_totals->>'total_fat')::numeric,
    total_saturated_fat = (p_totals->>'total_saturated_fat')::numeric,
    total_carbs         = (p_totals->>'total_carbs')::numeric,
    total_fiber         = (p_totals->>'total_fiber')::numeric,
    total_sugars        = (p_totals->>'total_sugars')::numeric,
    total_salt          = (p_totals->>'total_salt')::numeric,
    total_sodium        = (p_totals->>'total_sodium')::numeric,
    updated_at          = now()
  WHERE id = p_recipe_id;

  -- Replace ingredient rows atomically (delete-all then insert-new)
  DELETE FROM recipe_ingredients WHERE recipe_id = p_recipe_id;

  INSERT INTO recipe_ingredients (
    recipe_id, name, quantity, unit,
    energy, protein, fat, saturated_fat,
    carbs, fiber, sugars, salt, sodium
  )
  SELECT
    p_recipe_id,
    elem->>'name',
    (elem->>'quantity')::numeric,
    elem->>'unit',
    (elem->>'energy')::numeric,
    (elem->>'protein')::numeric,
    (elem->>'fat')::numeric,
    (elem->>'saturated_fat')::numeric,
    (elem->>'carbs')::numeric,
    (elem->>'fiber')::numeric,
    (elem->>'sugars')::numeric,
    (elem->>'salt')::numeric,
    (elem->>'sodium')::numeric
  FROM jsonb_array_elements(p_ingredients) AS elem;
END;
$$;
