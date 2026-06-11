import { test as setup } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const COOKIE_SOURCE = path.resolve(
  process.env.E2E_COOKIE_FILE ?? "e2e/fixtures/cookies.json"
);
const AUTH_STATE = path.resolve("e2e/fixtures/auth.json");

setup("load auth cookies", async ({ context }) => {
  if (!fs.existsSync(COOKIE_SOURCE)) {
    throw new Error(
      `Cookie file not found: ${COOKIE_SOURCE}\n` +
        `Export your browser session and place it at that path, or set E2E_COOKIE_FILE.`
    );
  }

  const raw = JSON.parse(fs.readFileSync(COOKIE_SOURCE, "utf-8"));

  // Accept either a raw array or the { cookies: [...] } envelope
  const cookies: object[] = Array.isArray(raw) ? raw : raw.cookies ?? raw;

  await context.addCookies(cookies as Parameters<typeof context.addCookies>[0]);
  await context.storageState({ path: AUTH_STATE });
});
