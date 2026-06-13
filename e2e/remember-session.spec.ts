import { expect, test } from '@playwright/test';

import {
  newIsolatedPage,
  registerIdentity,
  waitForWorkspace,
  type TestIdentity,
} from './support/pigeonApp';

test('restores a remembered session after reloading the app', async ({
  browser,
}, testInfo) => {
  const token = testRunToken(testInfo.project.name);
  const identity: TestIdentity = {
    handle: `remember${token}`,
    name: `Remember ${token}`,
    password: `P455uruD3su!${token}`,
  };
  const page = await newIsolatedPage(browser);

  try {
    await registerIdentity(page, identity);
    await page.reload();
    await waitForWorkspace(page);

    await expect(page.getByTestId('auth-submit-button')).toHaveCount(0);
    await expect(page.getByTestId('auth-password-input')).toHaveCount(0);
  } finally {
    await page.context().close();
  }
});

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}
