import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { saveInternState, INTERN_STATE_FILE } from '../helpers/storageState';

/**
 * Journey 2 — Availability Submission
 *
 * Uses stored auth state — loginAsIntern runs once in beforeAll, not per test.
 */

const SUBMIT_TIMEOUT = 25_000;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  await saveInternState(browser);
});

test.use({ storageState: INTERN_STATE_FILE });

test.describe('Availability Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/availability');
    await expect(page.getByText(/availability declaration/i)).toBeVisible({ timeout: 10_000 });
  });

  test('availability page loads with submission deadline visible', async ({ page }) => {
    await expect(page.getByText(/submission deadline/i)).toBeVisible({ timeout: 8_000 });
  });

  test('intern can submit availability as generally free', async ({ page }) => {
    await page.getByRole('button', { name: /submit weekly availability/i }).click();
    await expect(page.getByText(/availability submitted/i)).toBeVisible({ timeout: SUBMIT_TIMEOUT });
  });

  test('intern can submit availability with exam week flag', async ({ page }) => {
    // The exam week toggle is a button inside the row that contains "Exam Week" text
    const examRow = page.locator('div').filter({ hasText: /^Exam Week/ }).first();
    await examRow.getByRole('button').click();

    await page.getByRole('button', { name: /submit weekly availability/i }).click();
    await expect(page.getByText(/availability submitted/i)).toBeVisible({ timeout: SUBMIT_TIMEOUT });

    await expect(page.getByText(/yes/i).filter({ hasText: /−30|applied/i })).toBeVisible();
  });

  test('intern can add a busy block and submit', async ({ page }) => {
    await page.getByRole('button', { name: /add block/i }).click();
    await expect(page.locator('select').first()).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /submit weekly availability/i }).click();
    await expect(page.getByText(/availability submitted/i)).toBeVisible({ timeout: SUBMIT_TIMEOUT });

    await expect(page.getByText(/1 declared/i)).toBeVisible();
  });

  test('intern can re-submit for the same week', async ({ page }) => {
    await page.getByRole('button', { name: /submit weekly availability/i }).click();
    await expect(page.getByText(/availability submitted/i)).toBeVisible({ timeout: SUBMIT_TIMEOUT });

    await page.getByRole('button', { name: /submit another week/i }).click();
    await expect(page.getByRole('button', { name: /submit weekly availability/i })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /submit weekly availability/i }).click();
    await expect(page.getByText(/availability submitted/i)).toBeVisible({ timeout: SUBMIT_TIMEOUT });
  });
});
