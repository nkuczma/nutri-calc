/**
 * Run once to capture a real browser session:
 *   npx tsx e2e/save-auth.ts
 *
 * Opens a Chromium window. Log in manually, then press Enter in the terminal.
 * Saves all cookies to e2e/fixtures/cookies.json.
 */
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as readline from "readline";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = "e2e/fixtures/cookies.json";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL);
  console.log(`\nBrowser opened at ${BASE_URL}`);
  console.log("Log in manually, then press Enter here...\n");

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    rl.once("line", () => { rl.close(); resolve(); });
  });

  const cookies = await context.cookies();
  fs.writeFileSync(OUT, JSON.stringify(cookies, null, 2));
  console.log(`Saved ${cookies.length} cookie(s) to ${OUT}`);
  console.log(cookies.map((c) => `  ${c.name}`).join("\n"));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
