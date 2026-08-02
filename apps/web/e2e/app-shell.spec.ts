import { expect, test } from '@playwright/test';

test('renders the Scuttlebutt messaging workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Scuttlebutt', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'engineering' })).toBeVisible();
  await expect(page.getByTestId('message-timeline')).toContainText(
    'search indexing is ready for review',
  );
  await expect(page.getByTestId('message-composer')).toBeVisible();
});

test('sends a message and supports a reply context', async ({ page }) => {
  await page.goto('/');

  const composer = page.getByLabel('Write a message');
  await composer.fill('A small message from the browser test.');
  await page.getByTestId('send-message').click();
  await expect(page.getByTestId('message-timeline')).toContainText(
    'A small message from the browser test.',
  );

  await page.getByRole('button', { name: 'Reply to Maya Patel' }).first().click();
  await expect(page.getByText('Replying to Maya Patel')).toBeVisible();
});

test('opens the voice proof-of-concept controls for a voice channel', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Engineering Room/ }).click();
  await expect(page.getByTestId('voice-poc-panel')).toBeVisible();
  await expect(page.getByTestId('video-poc-panel')).toBeVisible();
  await expect(page.getByTestId('video-diagnostics')).toContainText('Resolution');
  await expect(page.getByLabel('Video quality').locator('option[value="ultra"]')).toHaveAttribute(
    'disabled',
    '',
  );
  await page.getByRole('button', { name: 'Join voice preview' }).click();
  await expect(page.getByText('connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mute' }).click();
  await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Meeting chat' })).toBeVisible();
  await expect(page.getByLabel('Engineering Room participants')).toContainText('Alex Rivers');
});

test('separates DMs from groups and creates local channels', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add a text channel' }).click();
  await page.getByLabel('Name').fill('release-planning');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'release-planning' })).toBeVisible();

  await page.getByRole('button', { name: 'Direct messages' }).click();
  await expect(page.getByText('Direct Messages', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a direct message' })).toBeVisible();
  await expect(page.getByText('Text channels', { exact: true })).not.toBeVisible();
});
