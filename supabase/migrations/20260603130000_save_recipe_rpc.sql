CREATE OR REPLACE FUNCTION public.save_recipe(
  p_user_id     uuid,
  p_title       text,
  p_raw_text    text,
  p_totals      jsonb,
  p_ingredients jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO recipes (
    user_id, title, raw_text,
    total_energy, total_protein, total_fat, total_saturated_fat,
    total_carbs, total_fiber, total_sugars, total_salt, total_sodium
  ) VALUES (
    p_user_id, p_title, p_raw_text,
    (p_totals->>'total_energy')::numeric,
    (p_totals->>'total_protein')::numeric,
    (p_totals->>'total_fat')::numeric,
    (p_totals->>'total_saturated_fat')::numeric,
    (p_totals->>'total_carbs')::numeric,
    (p_totals->>'total_fiber')::numeric,
    (p_totals->>'total_sugars')::numeric,
    (p_totals->>'total_salt')::numeric,
    (p_totals->>'total_sodium')::numeric
  )
  RETURNING id INTO v_id;

  INSERT INTO recipe_ingredients (
    recipe_id, name, quantity, unit,
    energy, protein, fat, saturated_fat,
    carbs, fiber, sugars, salt, sodium
  )
  SELECT
    v_id,
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

  RETURN v_id;
END;
$$;
