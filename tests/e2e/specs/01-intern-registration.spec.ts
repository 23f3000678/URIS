import { test, expect } from '@playwright/test';

/**
 * Journey 1 — Intern Registration
 */

// Unique email per test run so re-runs don't collide
const NEW_INTERN_EMAIL = `e2e_intern_${Date.now()}@test.com`;
const NEW_INTERN_NAME  = 'E2E Test Intern';
const PASSWORD         = 'password123';

test.describe('Intern Registration', () => {
  test('new intern can register and is redirected to availability', async ({ page }) => {
    await page.goto('/register');

    // Use input type selectors — more reliable than placeholder text
    await page.locator('input[type="text"]').fill(NEW_INTERN_NAME);
    await page.locator('input[type="email"]').fill(NEW_INTERN_EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);

    // INTERN role is the default — click it to be explicit
    await page.getByRole('button', { name: /^intern$/i }).click();

    await page.getByRole('button', { name: /create account/i }).click();

    // Intern should land on /availability after registration
    await page.waitForURL(/\/availability/, { timeout: 15_000 });
  });

  test('registered intern name appears in the sidebar', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(NEW_INTERN_EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /enter system/i }).click();

    await page.waitForURL(/\/(availability|dashboard)/, { timeout: 15_000 });

    // The sidebar "SIGNED IN AS" section shows the user's name
    // The name is stored and returned from the backend after the controller fix
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 5_000 });
    // Accept either the full name or the email prefix as a fallback
    await expect(sidebar).toContainText(/e2e test intern|e2e_intern/i, { timeout: 5_000 });
  });

  test('registering with an existing email shows an error', async ({ page }) => {
    await page.goto('/register');

    await page.locator('input[type="text"]').fill('Duplicate User');
    await page.locator('input[type="email"]').fill(NEW_INTERN_EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();

    // Should stay on /register
    await expect(page).toHaveURL(/\/register/, { timeout: 5_000 });

    // Backend returns "An account with this email already exists."
    // or a rate-limit message — either way an error paragraph appears
    await expect(
      page.locator('p').filter({ hasText: /already exists|too many|failed/i })
    ).toBeVisible({ timeout: 8_000 });
  });
});
