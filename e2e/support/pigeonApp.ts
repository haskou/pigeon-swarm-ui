import { expect, type Browser, type Locator, type Page } from '@playwright/test';

export type TestIdentity = {
  handle: string;
  name: string;
  password: string;
};

export async function newIsolatedPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();

  await context.addInitScript(() => {
    window.localStorage.setItem('pigeon-swarm-language-v2', 'en');
    window.localStorage.setItem('pigeon-swarm-language-explicit-v3', 'true');

    if (!window.sessionStorage.getItem('pigeon-swarm-e2e-storage-cleaned')) {
      window.localStorage.removeItem('pigeon-swarm-credentials');
      window.sessionStorage.setItem('pigeon-swarm-e2e-storage-cleaned', 'true');
    }

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
): Promise<void> {
  await page.goto('/');
  await page.getByTestId('auth-mode-control').locator('button').nth(1).click();
  await page.getByTestId('auth-name-input').fill(identity.name);
  await page.getByTestId('auth-handle-input').fill(identity.handle);
  await page.getByTestId('auth-password-input').fill(identity.password);
  await page
    .getByTestId('auth-password-confirmation-input')
    .fill(identity.password);

  const fallbackNetworks = page.getByTestId('auth-networks-input');

  if (await fallbackNetworks.isVisible().catch(() => false)) {
    const networkId = process.env.E2E_NETWORK_ID?.trim();

    if (!networkId) {
      throw new Error(
        'No node networks are available. Create a node network or set E2E_NETWORK_ID before running E2E tests.',
      );
    }

    await fallbackNetworks.fill(networkId);
  }

  await expect(page.getByTestId('auth-submit-button')).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByTestId('auth-submit-button').click();
  await waitForWorkspace(page);
  await dismissPushPrompt(page);
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
  await expect(page.getByTestId('create-conversation-submit-button')).toBeEnabled(
    { timeout: 45_000 },
  );
  await page.getByTestId('create-conversation-submit-button').click();
  await expect(
    page.getByTestId('create-conversation-recipient-input'),
  ).toBeHidden({ timeout: 45_000 });
  await dismissPushPrompt(page);
}

export async function acceptLatestInvitation(page: Page): Promise<void> {
  await openSidebar(page);
  await clickFirstVisible(page.getByTestId('notifications-open-button'));
  await expect(page.getByTestId('notification-accept-button').first()).toBeVisible(
    { timeout: 45_000 },
  );
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
  await expect(page.getByText(message, { exact: true })).toBeVisible({
    timeout: 45_000,
  });
}

export async function selectConversationByTitle(
  page: Page,
  title: string,
): Promise<Locator> {
  await openSidebar(page);
  const conversation = conversationRow(page, title);

  await expect(conversation).toBeVisible({ timeout: 30_000 });
  await conversation.click();

  return conversation;
}

export function conversationRow(page: Page, title: string): Locator {
  return page.getByTestId('conversation-list-item').filter({ hasText: title }).first();
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
        const nextBannerUrl = await conversation.getAttribute('data-banner-url');

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
  if (await isVisibleInViewport(page.getByTestId('create-conversation-button'))) {
    return;
  }

  if (await isVisibleInViewport(page.getByTestId('workspace-sidebar-open-button'))) {
    await clickFirstVisible(page.getByTestId('workspace-sidebar-open-button'));
  }

  await expect(page.getByTestId('create-conversation-button')).toBeVisible({
    timeout: 30_000,
  });
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
