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

  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByPlaceholder('Workspace name').fill('Scope Test');
  await page.getByPlaceholder('workspace-slug').fill(`scope-${unique}`);
  await page.locator('.compact-form').getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Create your first team')).toBeVisible();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByPlaceholder('Team name').fill('Core Team');
  await page.getByPlaceholder('KEY').fill('CORE');
  await page.locator('.compact-form').getByRole('button', { name: 'Create team' }).click();

  await expect(page.locator('.team-subnav')).toContainText('Members');
  await expect(page.locator('.workspace-nav')).not.toContainText('Members');

  for (const [index, status] of ['Backlog', 'Todo', 'In Progress', 'Done'].entries()) {
    await page.locator('.team-subnav').getByRole('button', { name: 'Issues' }).click();
    await page.getByRole('button', { name: 'New issue' }).click();
    const issueForm = page.locator('form.editor-card').first();
    await issueForm.getByLabel('Title').fill(`Visualization sample ${index + 1}`);
    await issueForm.getByLabel('Status').selectOption({ label: status });
    await issueForm.getByLabel('Priority').selectOption(String(Math.min(index + 1, 4)));
    await issueForm.getByLabel('Assignee').selectOption({ label: 'Playwright User' });
    await issueForm.getByRole('button', { name: 'Create issue' }).click();
    await expect(page.getByRole('heading', { name: 'Issue detail' })).toBeVisible();
  }

  await page.locator('.team-subnav').getByRole('button', { name: 'Summary' }).click();
  await expect(page.getByRole('heading', { name: 'Workflow composition' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Priority mix' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open workload' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project delivery' })).toBeVisible();
  await expect(page.getByRole('img', { name: /created and completed issue trend/i })).toBeVisible();
  await expect(page.locator('.composition-strip button')).toHaveCount(4);
  await expect(page.locator('.workload-list button')).toHaveCount(1);

  await page.locator('.team-subnav').getByRole('button', { name: 'Cycles' }).click();
  await expect(page.getByRole('heading', { name: 'Cycle schedule' })).toBeVisible();
  const rolloverCheckbox = await page.getByLabel('Move unfinished issues into the next cycle').boundingBox();
  expect(rolloverCheckbox.width).toBeLessThanOrEqual(18);
  expect(rolloverCheckbox.height).toBeLessThanOrEqual(18);
  await page.getByLabel('Enabled').check();
  await expect(page.getByLabel('Enabled')).toBeChecked();
  await page.getByRole('group', { name: 'Cycle duration' }).getByRole('button', { name: '2w' }).click();
  await page.getByRole('group', { name: 'Upcoming cycle count' }).getByRole('button', { name: '2', exact: true }).click();
  await page.getByLabel('Schedule starts').fill(new Date().toISOString().slice(0, 10));
  await expect(page.getByLabel('Enabled')).toBeChecked();
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await expect(page.locator('.cycle-card')).toHaveCount(3);
  await page.locator('.cycle-card').first().click();
  await expect(page.getByText('SPRINT BOARD')).toBeVisible();
  await expect(page.locator('.cycle-kanban .kanban-column')).toHaveCount(4);
});

test('login screen exposes password and optional Google flows', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
