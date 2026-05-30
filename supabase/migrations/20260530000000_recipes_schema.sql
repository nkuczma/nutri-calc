-- recipes: one row per saved recipe, owned by a user
CREATE TABLE recipes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  raw_text       TEXT,
  -- Nutrient totals snapshot (NULL = missing)
  total_energy      NUMERIC, total_protein     NUMERIC, total_fat         NUMERIC,
  total_carbs       NUMERIC, total_fiber       NUMERIC, total_sodium      NUMERIC,
  total_calcium     NUMERIC, total_iron        NUMERIC, total_vitamin_c   NUMERIC,
  total_vitamin_d   NUMERIC, total_zinc        NUMERIC, total_potassium   NUMERIC,
  total_vitamin_b12 NUMERIC, total_folate      NUMERIC, total_magnesium   NUMERIC,
  total_phosphorus  NUMERIC,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- recipe_ingredients: one row per ingredient, child of a recipe
CREATE TABLE recipe_ingredients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  quantity   NUMERIC     NOT NULL,
  unit       TEXT        NOT NULL,
  -- Per-ingredient nutrient values (NULL = missing)
  energy      NUMERIC, protein     NUMERIC, fat         NUMERIC,
  carbs       NUMERIC, fiber       NUMERIC, sodium      NUMERIC,
  calcium     NUMERIC, iron        NUMERIC, vitamin_c   NUMERIC,
  vitamin_d   NUMERIC, zinc        NUMERIC, potassium   NUMERIC,
  vitamin_b12 NUMERIC, folate      NUMERIC, magnesium   NUMERIC,
  phosphorus  NUMERIC,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX recipes_user_id_created_at_idx  ON recipes(user_id, created_at DESC);
CREATE INDEX recipe_ingredients_recipe_id_idx ON recipe_ingredients(recipe_id);

-- Enable RLS on both tables
ALTER TABLE recipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS: recipes — direct user_id check
CREATE POLICY "recipes_select" ON recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recipes_insert" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_update" ON recipes FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_delete" ON recipes FOR DELETE USING (auth.uid() = user_id);

-- RLS: recipe_ingredients — ownership via parent recipes row
CREATE POLICY "ri_select" ON recipe_ingredients FOR SELECT
  USING   (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "ri_insert" ON recipe_ingredients FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "ri_update" ON recipe_ingredients FOR UPDATE
  USING     (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "ri_delete" ON recipe_ingredients FOR DELETE
  USING   (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
