-- Migrate nutrient schema from USDA (17 fields) to Open Food Facts (9 fields).
-- Drops micronutrient columns, adds saturated_fat, sugars, salt.

-- recipe_ingredients: drop micronutrients
ALTER TABLE recipe_ingredients
  DROP COLUMN IF EXISTS calcium,
  DROP COLUMN IF EXISTS iron,
  DROP COLUMN IF EXISTS vitamin_c,
  DROP COLUMN IF EXISTS vitamin_d,
  DROP COLUMN IF EXISTS zinc,
  DROP COLUMN IF EXISTS potassium,
  DROP COLUMN IF EXISTS vitamin_b12,
  DROP COLUMN IF EXISTS folate,
  DROP COLUMN IF EXISTS magnesium,
  DROP COLUMN IF EXISTS phosphorus;

-- recipe_ingredients: add OFF-supported columns
ALTER TABLE recipe_ingredients
  ADD COLUMN IF NOT EXISTS saturated_fat NUMERIC,
  ADD COLUMN IF NOT EXISTS sugars        NUMERIC,
  ADD COLUMN IF NOT EXISTS salt          NUMERIC;

-- recipes: drop micronutrient totals
ALTER TABLE recipes
  DROP COLUMN IF EXISTS total_calcium,
  DROP COLUMN IF EXISTS total_iron,
  DROP COLUMN IF EXISTS total_vitamin_c,
  DROP COLUMN IF EXISTS total_vitamin_d,
  DROP COLUMN IF EXISTS total_zinc,
  DROP COLUMN IF EXISTS total_potassium,
  DROP COLUMN IF EXISTS total_vitamin_b12,
  DROP COLUMN IF EXISTS total_folate,
  DROP COLUMN IF EXISTS total_magnesium,
  DROP COLUMN IF EXISTS total_phosphorus;

-- recipes: add OFF-supported total columns
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS total_saturated_fat NUMERIC,
  ADD COLUMN IF NOT EXISTS total_sugars        NUMERIC,
  ADD COLUMN IF NOT EXISTS total_salt          NUMERIC;
