import {
  expect,
  type Browser,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from '@playwright/test';

export type TestIdentity = {
  handle: string;
  name: string;
  password: string;
};

export async function loginIdentity(
  page: Page,
  identity: string,
  password: string,
  recoveryKey?: string,
): Promise<void> {
  await page.goto('/');
  // A browser that last signed in as this identity shows it in place of the
  // identity input.
  const identityInput = page.getByTestId('auth-identity-input');
  const rememberedIdentity = page.getByTestId('auth-identity-preview');

  await expect(identityInput.or(rememberedIdentity).first()).toBeVisible({
    timeout: 30_000,
  });
  if (await rememberedIdentity.isVisible()) {
    await expect(rememberedIdentity).toContainText(identity.replace(/^@/, ''));
  } else {
    await identityInput.fill(identity, { timeout: 10_000 });
  }
  await page.getByTestId('auth-password-input').fill(password);

  if (recoveryKey) {
    await page
      .getByTestId('auth-login-method-control')
      .getByRole('button', { name: 'Recovery key' })
      .click();
    await page.getByTestId('auth-recovery-key-input').fill(recoveryKey);
    await page.getByTestId('auth-password-confirmation-input').fill(password);
  }

  await page.getByTestId('auth-submit-button').click();
  await waitForWorkspace(page);
  await dismissPushPrompt(page);
}

export async function newIsolatedPage(
  browser: Browser,
  options?: BrowserContextOptions,
): Promise<Page> {
  const context = await browser.newContext(options);

  await context.addInitScript(() => {
    window.localStorage.setItem('pigeon-swarm-language-v2', 'en');
    window.localStorage.setItem('pigeon-swarm-language-explicit-v3', 'true');

    const publicKeyCredential = window.PublicKeyCredential as
      | (typeof PublicKeyCredential & {
          getClientCapabilities?: () => Promise<Record<string, boolean>>;
        })
      | undefined;

    if (publicKeyCredential?.getClientCapabilities) {
      Object.defineProperty(publicKeyCredential, 'getClientCapabilities', {
        configurable: true,
        value: undefined,
      });
    }
  });

  return context.newPage();
}

export async function registerIdentity(
  page: Page,
  identity: TestIdentity,
): Promise<string> {
  await page.goto('/');
  await page.getByTestId('auth-mode-control').locator('button').nth(1).click();
  await page.getByTestId('auth-name-input').fill(identity.name);
  await page.getByTestId('auth-handle-input').fill(identity.handle);
  await page.getByTestId('auth-password-input').fill(identity.password);
  await page
    .getByTestId('auth-password-confirmation-input')
    .fill(identity.password);

  const fallbackNetworks = page.getByTestId('auth-networks-input');
  await page
    .getByTestId('auth-network-select')
    .waitFor({ timeout: 10_000 })
    .catch(() => undefined);

  if (await fallbackNetworks.isVisible().catch(() => false)) {
    const networkId = process.env.E2E_NETWORK_ID?.trim();

    if (!networkId) {
      throw new Error(
        'No node networks are available. Create a node network or set E2E_NETWORK_ID before running E2E tests.',
      );
    }

    await fallbackNetworks.fill(networkId);
  }

  const recoveryKey = await page
    .getByTestId('auth-recovery-key-output')
    .inputValue();

  await page.getByTestId('auth-recovery-key-confirm').click();
  await expect(page.getByTestId('auth-submit-button')).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId('auth-submit-button').click();
  await waitForWorkspace(page);
  await dismissPushPrompt(page);

  return recoveryKey;
}

export async function createDirectConversation(
  page: Page,
  recipientHandle: string,
): Promise<void> {
  await openSidebar(page);
  await clickFirstVisible(page.getByTestId('create-conversation-button'));
  await page
    .getByTestId('create-conversation-recipient-input')
    .fill(`@${recipientHandle}`);
  await expect(
    page.getByTestId('create-conversation-submit-button'),
  ).toBeEnabled({ timeout: 45_000 });
  await page.getByTestId('create-conversation-submit-button').click();
  await expect(
    page.getByTestId('create-conversation-recipient-input'),
  ).toBeHidden({ timeout: 45_000 });
  await dismissPushPrompt(page);
}

export async function acceptLatestInvitation(page: Page): Promise<void> {
  await openSidebar(page);
  await clickFirstVisible(page.getByTestId('notifications-open-button'));
  await expect(
    page.getByTestId('notification-accept-button').first(),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('notification-accept-button').first().click();
  await expect(page.getByTestId('message-composer-input')).toBeEnabled({
    timeout: 45_000,
  });
  await dismissPushPrompt(page);
}

export async function sendMessage(page: Page, message: string): Promise<void> {
  await expect(page.getByTestId('message-composer-input')).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId('message-composer-input').fill(message);
  await expect(page.getByTestId('message-send-button')).toBeVisible();
  await page.getByTestId('message-send-button').click();
  // An accepted send clears the composer. Until then the draft itself matches
  // the text below, so the timeline check would prove nothing.
  await expect(page.getByTestId('message-composer-input')).toHaveValue('');
  await expect(page.getByText(message, { exact: true })).toBeVisible({
    timeout: 45_000,
  });
}

export async function selectConversationByTitle(
  page: Page,
  title: string,
): Promise<Locator> {
  const conversation = conversationRow(page, title);

  // On a phone, creating a conversation opens it and slides the sidebar out.
  // The sidebar can still be in view when this starts, so a click that finds
  // the row slid away reopens the sidebar and tries again.
  await expect(async () => {
    await openSidebar(page);
    await conversation.click({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });

  return conversation;
}

export function conversationRow(page: Page, title: string): Locator {
  return page
    .getByTestId('conversation-list-item')
    .filter({ hasText: title })
    .first();
}

export async function updateOwnProfileBanner(
  page: Page,
  filePath: string,
): Promise<void> {
  await openSidebar(page);
  await clickFirstVisible(page.getByTestId('own-profile-menu-button'));
  await page.getByTestId('edit-profile-button').click();
  await page.getByTestId('profile-banner-input').setInputFiles(filePath);
  await expect(page.getByTestId('image-crop-apply-button')).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId('image-crop-apply-button').click();
  await expect(page.getByTestId('image-crop-apply-button')).toBeHidden({
    timeout: 30_000,
  });
  await expect(page.getByTestId('profile-save-button')).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId('profile-save-button').click();
  await expect(page.getByTestId('profile-save-button')).toBeHidden({
    timeout: 45_000,
  });
}

export async function waitForConversationBannerChange(
  page: Page,
  conversationTitle: string,
  previousBannerUrl: string | null,
): Promise<void> {
  await page.bringToFront();
  await openSidebar(page);
  const conversation = conversationRow(page, conversationTitle);

  await expect
    .poll(
      async () => {
        const nextBannerUrl =
          await conversation.getAttribute('data-banner-url');

        return nextBannerUrl && nextBannerUrl !== previousBannerUrl
          ? nextBannerUrl
          : null;
      },
      { timeout: 60_000 },
    )
    .not.toBeNull();
}

export async function waitForWorkspace(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        (await isVisibleInViewport(
          page.getByTestId('create-conversation-button'),
        )) ||
        (await isVisibleInViewport(
          page.getByTestId('workspace-sidebar-open-button'),
        )),
      { timeout: 45_000 },
    )
    .toBe(true);
}

export async function openSidebar(page: Page): Promise<void> {
  if (
    await isVisibleInViewport(page.getByTestId('create-conversation-button'))
  ) {
    return;
  }

  if (
    await isVisibleInViewport(page.getByTestId('workspace-sidebar-open-button'))
  ) {
    await clickFirstVisible(page.getByTestId('workspace-sidebar-open-button'));
  }

  await expect(page.getByTestId('create-conversation-button')).toBeVisible({
    timeout: 30_000,
  });
}

export async function pairNewDevice(
  authorized: Page,
  fresh: Page,
  identity: TestIdentity,
): Promise<void> {
  await reviewDevicePairing(authorized, fresh, identity);
  await authorizeDevicePairing(authorized, fresh, identity);
}

/**
 * Opens pairing on the signed-in device, prepares the request on the fresh
 * one, and reviews it until both show the same verification code.
 */
export async function reviewDevicePairing(
  authorized: Page,
  fresh: Page,
  identity: TestIdentity,
): Promise<void> {
  await openSecurityProfile(authorized);
  await authorized.getByTestId('profile-pair-device').click();

  const invitation = await authorized
    .getByTestId('device-pairing-invitation-output')
    .inputValue();

  expect(invitation).toMatch(/^\S+$/);

  await fresh.goto('/');
  await fresh.getByTestId('auth-identity-input').fill(`@${identity.handle}`);
  await fresh
    .getByTestId('auth-login-method-control')
    .getByRole('button', { name: 'New device' })
    .click();
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
}

/**
 * Confirms the reviewed pairing with the password and signs in on the fresh
 * device with the completion code.
 */
export async function authorizeDevicePairing(
  authorized: Page,
  fresh: Page,
  identity: TestIdentity,
): Promise<void> {
  await authorized
    .getByTestId('device-pairing-password-input')
    .fill(identity.password);
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
}

/**
 * Revokes the one other device from the device management dialog. With
 * compromisedSince the revoke is a compromise from that revision.
 */
export async function revokeOtherDevice(
  authorized: Page,
  compromisedSince?: number,
): Promise<void> {
  await openSecurityProfile(authorized);
  await authorized.getByTestId('profile-manage-devices').click();
  await expect(authorized.getByTestId('device-row')).toHaveCount(2);
  await authorized.getByTestId('device-revoke-open').click();

  if (compromisedSince !== undefined) {
    await authorized.getByTestId('device-mode-compromised').click();
    await authorized
      .getByTestId('device-compromise-since')
      .fill(String(compromisedSince));
  }

  await authorized.getByTestId('device-revoke-confirm').click();
  // The revoke is done only once every inbox of every server cut it off.
  await expect(authorized.getByTestId('device-row')).toHaveCount(1, {
    timeout: 60_000,
  });
}

export async function openSecurityProfile(page: Page): Promise<void> {
  await openSidebar(page);
  await page
    .locator('[data-testid="own-profile-menu-button"]:visible')
    .first()
    .click();
  await page.getByTestId('edit-profile-button').click();
  await page.getByRole('button', { name: 'Security' }).click();
}

async function dismissPushPrompt(page: Page): Promise<void> {
  const prompt = page.getByTestId('push-notification-prompt');

  if (!(await isVisible(prompt))) return;

  await page.getByTestId('push-notification-dismiss-button').click();
  await expect(prompt).toBeHidden({ timeout: 10_000 });
}

async function clickFirstVisible(locator: Locator): Promise<void> {
  await expect
    .poll(async () => visibleLocatorIndex(locator), { timeout: 30_000 })
    .not.toBe(-1);

  const index = await visibleLocatorIndex(locator);
  const target = locator.nth(index);

  await target.scrollIntoViewIfNeeded();
  await target.click({ timeout: 10_000 }).catch(async () => {
    await target.click({ force: true, timeout: 10_000 });
  });
}

async function visibleLocatorIndex(locator: Locator): Promise<number> {
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    if (await isVisibleInViewport(locator.nth(index))) return index;
  }

  return -1;
}

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

async function isVisibleInViewport(locator: Locator): Promise<boolean> {
  return locator
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      );
    })
    .catch(() => false);
}
