import { expect, test } from '@playwright/test';

import { newIsolatedPage, registerIdentity, type TestIdentity } from './support/pigeonApp';

test('keeps the empty members column visible without an open chat', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The persistent members column is only rendered on the desktop layout.',
  );

  const token = testRunToken();
  const identity: TestIdentity = {
    handle: `emptymembers${token}`,
    name: `Empty Members ${token}`,
    password: `P455uruD3su!${token}`,
  };
  const page = await newIsolatedPage(browser);

  try {
    await registerIdentity(page, identity);

    await expect(page.getByTestId('identity-members-aside')).toBeVisible();
    await expect(page.getByTestId('identity-member-row')).toHaveCount(0);
  } finally {
    await page.context().close();
  }
});

function testRunToken(): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${timestamp}${random}`.toLowerCase();
}
