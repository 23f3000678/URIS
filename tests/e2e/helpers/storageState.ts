/**
 * storageState.ts
 *
 * Playwright supports saving browser storage state (cookies + localStorage)
 * after a login and reusing it across tests. This means each spec file logs
 * in once via the API (no UI), saves the state, and all tests in that file
 * reuse it — eliminating repeated UI logins that exhaust the rate limiter.
 *
 * Usage in a spec file:
 *
 *   test.use({ storageState: ADMIN_STATE_FILE });
 *
 *   test.beforeAll(async ({ browser }) => {
 *     await saveAdminState(browser);
 *   });
 */

import type { Browser } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ADMIN_EMAIL, INTERN_EMAIL, PASSWORD } from './auth';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export const AUTH_DIR          = path.join(__dirname, '../.auth');
export const ADMIN_STATE_FILE  = path.join(AUTH_DIR, 'admin.json');
export const INTERN_STATE_FILE = path.join(AUTH_DIR, 'intern.json');

// Pre-create the .auth directory and placeholder files so Playwright can
// reference them via test.use({ storageState }) before beforeAll runs.
// The real session data is written by saveAdminState / saveInternState.
fs.mkdirSync(AUTH_DIR, { recursive: true });
if (!fs.existsSync(ADMIN_STATE_FILE)) {
  fs.writeFileSync(ADMIN_STATE_FILE,  JSON.stringify({ cookies: [], origins: [] }));
}
if (!fs.existsSync(INTERN_STATE_FILE)) {
  fs.writeFileSync(INTERN_STATE_FILE, JSON.stringify({ cookies: [], origins: [] }));
}

async function saveState(
  browser: Browser,
  email: string,
  stateFile: string,
): Promise<void> {
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /enter system/i }).click();
  await page.waitForURL(/\/(dashboard|availability)/, { timeout: 20_000 });

  await context.storageState({ path: stateFile });
  await context.close();
}

export async function saveAdminState(browser: Browser): Promise<void> {
  await saveState(browser, ADMIN_EMAIL, ADMIN_STATE_FILE);
}

export async function saveInternState(browser: Browser): Promise<void> {
  await saveState(browser, INTERN_EMAIL, INTERN_STATE_FILE);
}
