// Quick manual test for convertToGrams
// Run with:  npx tsx test-convert.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { convertToGrams } from "./src/lib/unit-conversion";

async function main() {
  const tests = [
    { name: "flour",  quantity: 2,   unit: "cups", expect: "~240" },
    { name: "salt",   quantity: 1,   unit: "tsp",  expect: "~6" },
    { name: "butter", quantity: 100, unit: "g",    expect: "100 (mass passthrough, no API call)" },
    { name: "sugar",  quantity: 1,   unit: "cup",  expect: "~200" },
  ];

  console.log("Testing convertToGrams...\n");

  for (const t of tests) {
    process.stdout.write(`  ${t.quantity} ${t.unit} ${t.name} → `);
    const result = await convertToGrams(t.name, t.quantity, t.unit);
    console.log(`${result}  (expected ${t.expect})`);
  }

  // Fallback test: corrupt Spoonacular key to force OpenRouter path
  console.log("\n--- Fallback test (invalid Spoonacular key → OpenRouter) ---");
  const orig = process.env.SPOONACULAR_API_KEY;
  process.env.SPOONACULAR_API_KEY = "INVALID_KEY";
  process.stdout.write("  2 cups flour (forced OpenRouter fallback) → ");
  const result = await convertToGrams("flour", 2, "cups");
  console.log(`${result}  (should be a number, not "missing")`);
  process.env.SPOONACULAR_API_KEY = orig;
}

main();
