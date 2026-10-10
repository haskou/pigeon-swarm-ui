import { expect, test } from '@playwright/test';

import {
  newIsolatedPage,
  registerIdentity,
  waitForWorkspace,
  type TestIdentity,
} from './support/pigeonApp';

test('prefills the last login identity after reload and still requires the password', async ({
  browser,
}, testInfo) => {
  const token = testRunToken(testInfo.project.name);
  const identity: TestIdentity = {
    handle: `prefill${token}`,
    name: `Prefill ${token}`,
    password: `P455uruD3su!${token}`,
  };
  const page = await newIsolatedPage(browser);

  try {
    await registerIdentity(page, identity);
    await page.reload();

    await expect(page.getByTestId('auth-identity-input')).not.toHaveValue('');
    await page.getByTestId('auth-password-input').fill(identity.password);
    await page.getByTestId('auth-submit-button').click();
    await waitForWorkspace(page);
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
