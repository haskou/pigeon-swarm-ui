import { expect, test } from '@playwright/test';

import {
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  type TestIdentity,
} from './support/pigeonApp';

const FINGERPRINT = /^([0-9A-F]{4} ){7}[0-9A-F]{4}$/;

function newIdentity(projectName: string): TestIdentity {
  const token =
    `${projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4)}${Date.now()
      .toString(36)
      .slice(-6)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();

  return {
    handle: `audit${token}`,
    name: `audit ${token}`,
    password: `P455uruD3su!${token}`,
  };
}

test('shows ids and fingerprints in the security audit without key material', async ({
  browser,
}, testInfo) => {
  const identity = newIdentity(testInfo.project.name);
  const page = await newIsolatedPage(browser);

  try {
    const recoveryKey = await registerIdentity(page, identity);

    await openSidebar(page);
    await page
      .locator('[data-testid="own-profile-menu-button"]:visible')
      .first()
      .click();
    await page.getByTestId('edit-profile-button').click();
    await page.getByRole('button', { name: 'Security' }).click();

    const toggle = page.getByTestId('security-audit-toggle');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('security-audit-report')).toHaveCount(0);

    await toggle.click();

    const account = page.getByTestId('security-audit-account');

    await expect(account).toBeVisible({ timeout: 30_000 });

    const values = account.locator('code');

    await expect(values.nth(0)).toHaveText(/^\S{20,}$/);
    await expect(values.nth(1)).toHaveText(FINGERPRINT);
    await expect(
      page.getByTestId('security-audit-report').getByText('This device'),
    ).not.toHaveCount(0);

    const html = await page.content();

    expect(html).not.toContain(recoveryKey);
    expect(html).not.toContain(identity.password);
    expect(html).not.toContain('PRIVATE KEY');
  } finally {
    await page.context().close();
  }
});
