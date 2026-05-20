import type { Page } from '@playwright/test';

// ── Seed credentials (password: 123456 for all) ───────────────────────────────
export const ADMIN_EMAIL  = 'admin@uris.com';
export const INTERN_EMAIL = 'rahul@uris.com';
export const PASSWORD     = '123456';

// ── Internal helper ───────────────────────────────────────────────────────────

async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  // Locate by input type — avoids fragile placeholder text matching
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /enter system/i }).click();
}

// ── Login helpers ─────────────────────────────────────────────────────────────

export async function loginAsAdmin(page: Page): Promise<void> {
  await fillLoginForm(page, ADMIN_EMAIL, PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

export async function loginAsIntern(page: Page): Promise<void> {
  await fillLoginForm(page, INTERN_EMAIL, PASSWORD);
  await page.waitForURL(/\/(availability|dashboard)/, { timeout: 20_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}
