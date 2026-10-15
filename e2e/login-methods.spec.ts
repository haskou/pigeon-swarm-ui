import { expect, test, type Page } from '@playwright/test';

import {
  authorizeDevicePairing,
  newIsolatedPage,
  pairNewDevice,
  registerIdentity,
  reviewDevicePairing,
  revokeOtherDevice,
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
    await pairNewDevice(authorized, fresh, identity);
    await revokeOtherDevice(authorized, 1);
  } finally {
    await authorized.context().close();
    await fresh.context().close();
  }
});

test('authorizes no new device with a wrong password', async ({
  browser,
}, testInfo) => {
  const identity = newIdentity(testInfo.project.name, 'deny');
  const authorized = await newIsolatedPage(browser);
  const fresh = await newIsolatedPage(browser);
  const deviceWrites: string[] = [];

  try {
    await registerIdentity(authorized, identity);
    await reviewDevicePairing(authorized, fresh, identity);

    authorized.on('request', (request) => {
      if (
        request.method() !== 'GET' &&
        new URL(request.url()).pathname.includes('/identity-devices/')
      ) {
        deviceWrites.push(`${request.method()} ${request.url()}`);
      }
    });
    await authorized
      .getByTestId('device-pairing-password-input')
      .fill(`${identity.password}wrong`);
    await authorized.getByTestId('device-pairing-submit').click();

    // The password is checked with the stored key derivation, which is slow.
    await expect(
      authorized.getByText('Your password could not be confirmed.'),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      authorized.getByTestId('device-pairing-completion-output'),
    ).toBeHidden();
    await expect(
      authorized.getByTestId('device-pairing-password-input'),
    ).toHaveValue('');
    expect(deviceWrites).toEqual([]);

    // The refusal consumed nothing: the right password still pairs.
    await authorizeDevicePairing(authorized, fresh, identity);
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
