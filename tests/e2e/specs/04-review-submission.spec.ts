import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { saveAdminState, ADMIN_STATE_FILE } from '../helpers/storageState';
import fs from 'fs';

/**
 * Journey 4 — Review Submission by Admin
 *
 * Uses stored auth state so loginAsAdmin is called only once per spec run,
 * avoiding rate-limiter exhaustion from repeated beforeEach logins.
 */

// Log in once before all tests in this file and save the browser state
test.beforeAll(async ({ browser }: { browser: Browser }) => {
  await saveAdminState(browser);
});

// All tests in this file reuse the saved admin session
test.use({ storageState: ADMIN_STATE_FILE });

test.describe('Review Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/review');
    await expect(page.getByText(/task review/i)).toBeVisible({ timeout: 10_000 });
  });

  test('review page loads with completed task selector', async ({ page }) => {
    await expect(page.getByText(/select completed task/i)).toBeVisible({ timeout: 8_000 });
  });

  test('admin can select a completed task from the dropdown', async ({ page }) => {
    // Open the task dropdown
    await page.getByRole('button', { name: /choose a completed task/i }).click();

    // At least one completed task should be listed (from seed data)
    const dropdownItem = page.locator('[style*="zIndex: 200"] button, [style*="z-index: 200"] button').first();
    await expect(dropdownItem).toBeVisible({ timeout: 8_000 });
    await dropdownItem.click();

    // The placeholder text should no longer say "Choose a completed task..."
    await expect(
      page.getByRole('button', { name: /choose a completed task/i })
    ).not.toBeVisible({ timeout: 3_000 });
  });

  test('rating all dimensions shows live PPS preview', async ({ page }) => {
    // Select a task
    await page.getByRole('button', { name: /choose a completed task/i }).click();
    const dropdownItem = page.locator('[style*="zIndex: 200"] button, [style*="z-index: 200"] button').first();
    await expect(dropdownItem).toBeVisible({ timeout: 8_000 });
    await dropdownItem.click();

    // Rate each dimension by clicking the nth star button inside each section
    // The rating buttons are inside .glass-card sections — click the 4th star in each
    const ratingCards = page.locator('.glass-card').filter({ hasText: /weight \d+%/i });
    const count = await ratingCards.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = ratingCards.nth(i);
      // Click the 4th button (rating = 4) inside this card
      await card.getByRole('button').nth(3).click();
    }

    // PPS preview should now be visible
    await expect(page.getByText(/performance score preview/i)).toBeVisible({ timeout: 5_000 });
  });

  test('admin can submit a review and see success state', async ({ page }) => {
    // Select a task
    await page.getByRole('button', { name: /choose a completed task/i }).click();
    const dropdownItem = page.locator('[style*="zIndex: 200"] button, [style*="z-index: 200"] button').first();
    await expect(dropdownItem).toBeVisible({ timeout: 8_000 });
    await dropdownItem.click();

    // Rate all three dimensions
    const ratingCards = page.locator('.glass-card').filter({ hasText: /weight \d+%/i });
    const count = await ratingCards.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await ratingCards.nth(i).getByRole('button').nth(3).click();
    }

    await page.getByRole('button', { name: /submit performance review/i }).click();

    // Success state or duplicate review error — both are valid
    await expect(
      page.locator('h2, p').filter({ hasText: /review submitted|already been submitted/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
