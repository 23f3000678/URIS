import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { saveInternState, INTERN_STATE_FILE } from '../helpers/storageState';

/**
 * Journey 5 — Intern Dashboard Score Visibility
 *
 * Uses stored auth state — loginAsIntern runs once in beforeAll, not per test.
 */

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  await saveInternState(browser);
});

test.use({ storageState: INTERN_STATE_FILE });

test.describe('Intern Dashboard Scores', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('intern dashboard loads with welcome header', async ({ page }) => {
    await expect(page.getByText(/welcome/i)).toBeVisible({ timeout: 10_000 });
  });

  test('capacity score ring is visible with a numeric value', async ({ page }) => {
    await expect(page.getByText(/capacity score/i)).toBeVisible({ timeout: 10_000 });

    // Score rings render numbers 0–100 inside SVG spans
    const scoreText = page.locator('span').filter({ hasText: /^\d{1,3}$/ }).first();
    await expect(scoreText).toBeVisible({ timeout: 10_000 });

    const value = parseInt(await scoreText.textContent() ?? '0', 10);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });

  test('performance index ring is visible', async ({ page }) => {
    await expect(page.getByText(/performance index/i)).toBeVisible({ timeout: 10_000 });
  });

  test('credibility ring is visible', async ({ page }) => {
    await expect(page.getByText(/credibility/i)).toBeVisible({ timeout: 10_000 });
  });

  test('raw performance score is shown below the rings', async ({ page }) => {
    await expect(page.getByText(/performance score/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/\/5/)).toBeVisible({ timeout: 5_000 });
  });

  test('assigned tasks section is present', async ({ page }) => {
    await expect(page.getByText(/your tasks/i)).toBeVisible({ timeout: 10_000 });
  });

  test('activity summary card is present', async ({ page }) => {
    await expect(page.getByText(/activity summary/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/active hrs/i)).toBeVisible({ timeout: 5_000 });
  });

  test('intern can navigate to tasks page and see their tasks', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.getByText(/task monitor/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/total/i)).toBeVisible({ timeout: 8_000 });
  });
});
