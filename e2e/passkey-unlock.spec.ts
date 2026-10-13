import { expect, test, type Page } from '@playwright/test';

import {
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  waitForWorkspace,
  type TestIdentity,
} from './support/pigeonApp';

// WebAuthn rejects IP addresses as relying party ids, so the suite reaches the
// same server through `localhost`.
function localhostBaseUrl(baseUrl: string | undefined): string {
  const url = new URL(baseUrl ?? 'http://127.0.0.1:8080');

  url.hostname = 'localhost';

  return url.origin;
}

async function addVirtualPasskeyAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);

  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      automaticPresenceSimulation: true,
      ctap2Version: 'ctap2_1',
      hasPrf: true,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      protocol: 'ctap2',
      transport: 'internal',
    },
  });
}

async function openSecuritySettings(page: Page): Promise<void> {
  await openSidebar(page);
  await page
    .locator('[data-testid="own-profile-menu-button"]:visible')
    .first()
    .click();
  await page.getByTestId('edit-profile-button').click();
  await page.getByRole('button', { name: 'Security' }).click();
}

test('replaces the device password with a passkey and unlocks with it', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The virtual authenticator is a Chromium DevTools feature.',
  );

  const token = `${Date.now().toString(36).slice(-6)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const identity: TestIdentity = {
    handle: `passkey${token}`,
    name: `Passkey ${token}`,
    password: `P455uruD3su!${token}`,
  };
  const page = await newIsolatedPage(browser, {
    baseURL: localhostBaseUrl(testInfo.project.use.baseURL),
  });

  try {
    await addVirtualPasskeyAuthenticator(page);
    await registerIdentity(page, identity);
    await openSecuritySettings(page);

    const passkeySection = page.getByTestId('profile-passkey-unlock');

    await passkeySection.getByTestId('profile-passkey-toggle').click();
    await passkeySection
      .locator('input[type="password"]')
      .fill(identity.password);
    await passkeySection.getByTestId('profile-passkey-submit').click();
    await expect(passkeySection).toContainText(
      'Your password no longer works here.',
      { timeout: 30_000 },
    );

    await page.reload();

    await expect(page.getByTestId('auth-passkey-unlock-help')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('auth-password-input')).toHaveCount(0);
    await page.getByTestId('auth-submit-button').click();
    await waitForWorkspace(page);
  } finally {
    await page.context().close();
  }
});
