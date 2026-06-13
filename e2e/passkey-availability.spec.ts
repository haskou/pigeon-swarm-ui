import { expect, test } from '@playwright/test';

import { newIsolatedPage } from './support/pigeonApp';

test('warns when device unlock protection is unavailable', async ({
  browser,
}) => {
  const page = await newIsolatedPage(browser);

  try {
    await page.goto('/');

    await expect(page.getByTestId('auth-passkey-prf-warning')).toBeVisible();
    await expect(page.getByTestId('auth-passkey-prf-warning')).toContainText(
      'Device unlock is not available here.',
    );

    await page.getByTestId('auth-mode-control').locator('button').nth(1).click();

    await expect(page.getByTestId('auth-passkey-prf-warning')).toBeVisible();
    await expect(page.getByTestId('auth-passkey-prf-toggle')).toBeDisabled();
  } finally {
    await page.context().close();
  }
});
