import { expect, test } from '@playwright/test';

test('renders the Scuttlebutt messaging workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Scuttlebutt', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '# Lounge' })).toBeVisible();
  await expect(page.getByTestId('message-timeline')).toContainText(
    'Welcome to the Scuttlebutt lounge.',
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

  await page.getByRole('button', { name: 'Reply to Jordan Lee' }).first().click();
  await expect(page.getByText('Replying to Jordan Lee')).toBeVisible();
});
