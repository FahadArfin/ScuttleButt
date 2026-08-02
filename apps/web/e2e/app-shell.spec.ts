import { expect, test } from '@playwright/test';

test('renders the Scuttlebutt application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Scuttlebutt' })).toBeVisible();
  await expect(page.getByText('Foundation online')).toBeVisible();
});
