import { expect, test } from '@playwright/test';

test('registration reaches workspace navigation and preserves scope boundaries', async ({ page }) => {
  const unique = Date.now();
  await page.goto('/');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.getByLabel('Name').fill('Playwright User');
  await page.getByLabel('Email').fill(`playwright-${unique}@example.com`);
  await page.getByLabel('Password').fill('CommonPlan-test-123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Create your first workspace')).toBeVisible();
  await expect(page.locator('.workspace-nav')).toContainText('My Issues');
  await expect(page.locator('.workspace-nav')).toContainText('Views');
  await expect(page.locator('.workspace-nav')).toContainText('Inbox');
  await expect(page.locator('.workspace-nav')).toContainText('Settings');
  await expect(page.locator('.team-list')).not.toContainText('Inbox');
});

test('login screen exposes password and optional Google flows', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
