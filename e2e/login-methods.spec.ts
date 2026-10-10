import { expect, test, type Page } from '@playwright/test';

import {
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  waitForWorkspace,
  type TestIdentity,
} from './support/pigeonApp';

test('shows the three login choices with instructions for each box', async ({
  browser,
}) => {
  const page = await newIsolatedPage(browser);

  try {
    await page.goto('/');
    const methods = page.getByTestId('auth-login-method-control');

    await expect(methods.getByRole('button')).toHaveText([
      'Password',
      'New device',
      'Recovery key',
    ]);
    await expect(page.getByTestId('auth-recovery-key-input')).toBeHidden();

    await methods.getByRole('button', { name: 'Recovery key' }).click();
    await expect(page.getByTestId('auth-recovery-key-input')).toHaveAttribute(
      'placeholder',
      'psrk1...',
    );
    await expect(page.getByText('it starts with psrk1')).toBeVisible();
    await expect(page.getByText('New password for this device')).toBeVisible();

    await methods.getByRole('button', { name: 'New device' }).click();
    await expect(page.getByTestId('auth-recovery-key-input')).toBeHidden();
    await expect(
      page.getByTestId('auth-device-pairing-invitation-input'),
    ).toHaveAttribute('placeholder', /invitation code/);
    await expect(
      page.getByTestId('auth-device-pairing-prepare'),
    ).toBeDisabled();
    await expect(
      page.getByTestId('auth-device-pairing-completion-input'),
    ).toBeHidden();
  } finally {
    await page.context().close();
  }
});

test('signs in on a new device with the recovery key', async ({
  browser,
}, testInfo) => {
  const identity = newIdentity(testInfo.project.name, 'rec');
  const first = await newIsolatedPage(browser);
  const second = await newIsolatedPage(browser);

  try {
    const recoveryKey = await registerIdentity(first, identity);

    await second.goto('/');
    await second.getByTestId('auth-identity-input').fill(`@${identity.handle}`);
    await chooseMethod(second, 'Recovery key');
    await second.getByTestId('auth-recovery-key-input').fill(recoveryKey);
    await second.getByTestId('auth-password-input').fill(identity.password);
    await second
      .getByTestId('auth-password-confirmation-input')
      .fill(identity.password);
    await second.getByTestId('auth-submit-button').click();
    await waitForWorkspace(second);
  } finally {
    await first.context().close();
    await second.context().close();
  }
});

test('adds a new device by pairing it with a signed-in device', async ({
  browser,
}, testInfo) => {
  const identity = newIdentity(testInfo.project.name, 'pair');
  const authorized = await newIsolatedPage(browser);
  const fresh = await newIsolatedPage(browser);

  try {
    await registerIdentity(authorized, identity);
    await openSidebar(authorized);
    await authorized
      .locator('[data-testid="own-profile-menu-button"]:visible')
      .first()
      .click();
    await authorized.getByTestId('edit-profile-button').click();
    await authorized.getByRole('button', { name: 'Security' }).click();
    await authorized.getByTestId('profile-pair-device').click();

    const invitation = await authorized
      .getByTestId('device-pairing-invitation-output')
      .inputValue();

    expect(invitation).toMatch(/^\S+$/);

    await fresh.goto('/');
    await fresh.getByTestId('auth-identity-input').fill(`@${identity.handle}`);
    await chooseMethod(fresh, 'New device');
    await fresh
      .getByTestId('auth-device-pairing-invitation-input')
      .fill(invitation);
    await fresh.getByTestId('auth-device-pairing-prepare').click();

    const request = await fresh
      .getByTestId('auth-device-pairing-request-output')
      .inputValue();
    const newDeviceCode = await fresh
      .getByTestId('auth-device-pairing-verification-code')
      .innerText();

    await authorized.getByTestId('device-pairing-request-input').fill(request);
    await authorized.getByTestId('device-pairing-submit').click();
    await expect(
      authorized.getByTestId('device-pairing-verification-code'),
    ).toHaveText(newDeviceCode);
    await authorized.getByTestId('device-pairing-submit').click();

    const completionOutput = authorized.getByTestId(
      'device-pairing-completion-output',
    );

    await expect(completionOutput).toBeVisible();

    const completion = await completionOutput.inputValue();

    await fresh
      .getByTestId('auth-device-pairing-completion-input')
      .fill(completion);
    await fresh.getByTestId('auth-password-input').fill(identity.password);
    await fresh
      .getByTestId('auth-password-confirmation-input')
      .fill(identity.password);
    await fresh.getByTestId('auth-submit-button').click();
    await waitForWorkspace(fresh);

    await authorized
      .getByRole('button', { name: 'Close dialog' })
      .last()
      .click();
    await authorized.getByTestId('profile-manage-devices').click();
    await expect(authorized.getByTestId('device-row')).toHaveCount(2);
    await authorized.getByTestId('device-revoke-open').click();
    await authorized.getByTestId('device-mode-compromised').click();
    await authorized.getByTestId('device-compromise-since').fill('1');
    await authorized.getByTestId('device-revoke-confirm').click();
    await expect(authorized.getByTestId('device-row')).toHaveCount(1);
  } finally {
    await authorized.context().close();
    await fresh.context().close();
  }
});

async function chooseMethod(page: Page, name: string): Promise<void> {
  await page
    .getByTestId('auth-login-method-control')
    .getByRole('button', { name })
    .click();
}

function newIdentity(projectName: string, prefix: string): TestIdentity {
  const token =
    `${projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4)}${Date.now()
      .toString(36)
      .slice(-6)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();

  return {
    handle: `${prefix}${token}`,
    name: `${prefix} ${token}`,
    password: `P455uruD3su!${token}`,
  };
}
