import { expect, type Page, test } from '@playwright/test';

import {
  acceptLatestInvitation,
  createDirectConversation,
  newIsolatedPage,
  pairNewDevice,
  registerIdentity,
  revokeOtherDevice,
  selectConversationByTitle,
  sendMessage,
  type TestIdentity,
} from './support/pigeonApp';

// How long the revoked device keeps syncing after the surviving device has
// shown the post-revoke message, before the test checks it never showed it.
const REVOKED_SYNC_WINDOW_MS = 20_000;

test('locks a revoked device out of the direct messages sent after the revoke', async ({
  browser,
}, testInfo) => {
  test.slow();

  const token = testRunToken(testInfo.project.name);
  const password = `P455uruD3su!${token}`;
  const alice: TestIdentity = {
    handle: `alice${token}`,
    name: `Alice ${token}`,
    password,
  };
  const bob: TestIdentity = {
    handle: `bob${token}`,
    name: `Bob ${token}`,
    password,
  };
  const bobMessage = `hello from bob ${token}`;
  const beforeRevoke = `before the revoke ${token}`;
  const afterRevoke = `after the revoke ${token}`;
  const alicePage = await newIsolatedPage(browser);
  const phone = await newIsolatedPage(browser);
  const laptop = await newIsolatedPage(browser);

  try {
    await registerIdentity(alicePage, alice);
    await registerIdentity(phone, bob);
    await createDirectConversation(alicePage, bob.handle);
    await acceptLatestInvitation(phone);
    await pairNewDevice(phone, laptop, bob);

    await selectConversationByTitle(alicePage, bob.name);
    await selectConversationByTitle(phone, alice.name);
    await selectConversationByTitle(laptop, alice.name);

    // Bob sends first, so both inboxes are open before Alice sends.
    await sendMessage(phone, bobMessage);
    await expect(alicePage.getByText(bobMessage, { exact: true })).toBeVisible({
      timeout: 45_000,
    });
    await sendMessage(alicePage, beforeRevoke);
    await expect(phone.getByText(beforeRevoke, { exact: true })).toBeVisible({
      timeout: 45_000,
    });
    await expect(laptop.getByText(beforeRevoke, { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    await revokeOtherDevice(phone);
    await phone.getByRole('button', { name: 'Close dialog' }).last().click();
    await selectConversationByTitle(phone, alice.name);

    await sendMessage(alicePage, afterRevoke);
    await expect(phone.getByText(afterRevoke, { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    // The revoked laptop keeps its old root and the conversation secret, and
    // keeps syncing the open conversation, yet never shows the new message.
    await laptop.waitForTimeout(REVOKED_SYNC_WINDOW_MS);
    await expect(laptop.getByText(beforeRevoke, { exact: true })).toBeVisible();
    await expect(laptop.getByText(afterRevoke, { exact: true })).toHaveCount(0);
    await expect.poll(() => storedHistoryRows(laptop)).toBeGreaterThan(0);

    // On its next sign-in the node reports the laptop as removed. That answer
    // is not signed, so the laptop says so and keeps what it stored.
    await signIn(laptop, bob);
    await expect(
      laptop.getByText('This device was removed from your account.'),
    ).toBeVisible({ timeout: 45_000 });
    await expect(
      laptop.getByText(
        'The messages saved on this browser stay until you erase them.',
        { exact: false },
      ),
    ).toBeVisible();
    expect(await storedHistoryRows(laptop)).toBeGreaterThan(0);

    // Only the explicit action erases them.
    await laptop
      .getByRole('button', { name: 'Erase local copy and start over' })
      .click();
    await expect.poll(() => storedHistoryRows(laptop)).toBe(0);

    // A node that forges the same answer for a device that is still
    // authorized (401020 on the device-signed read, then a catalog without
    // this device) gets the notice shown and nothing erased.
    await expect.poll(() => storedHistoryRows(phone)).toBeGreaterThan(0);
    await forgeDeviceRemoval(phone);
    await signIn(phone, bob);
    await expect(
      phone.getByText('This device was removed from your account.'),
    ).toBeVisible({ timeout: 45_000 });
    expect(await storedHistoryRows(phone)).toBeGreaterThan(0);
  } finally {
    await alicePage.context().close();
    await phone.context().close();
    await laptop.context().close();
  }
});

async function signIn(page: Page, identity: TestIdentity): Promise<void> {
  await page.goto('/');
  await page.getByTestId('auth-identity-input').fill(`@${identity.handle}`);
  await page.getByTestId('auth-password-input').fill(identity.password);
  await page.getByTestId('auth-submit-button').click();
}

/**
 * Answers the device-signed checkpoint read with 401020 and strips every
 * credential from the device catalog, as a lying node could.
 */
async function forgeDeviceRemoval(page: Page): Promise<void> {
  await page.route(
    (url) => /\/identity-devices\/[^/]+(\/devices)?$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();

        return;
      }

      if (new URL(route.request().url()).pathname.endsWith('/devices')) {
        const response = await route.fetch();
        const catalog = (await response.json()) as Record<string, unknown>;

        await route.fulfill({
          json: { ...catalog, credentials: [] },
          response,
        });

        return;
      }

      await route.fulfill({
        json: { code: 401020, message: 'Invalid signed request' },
        status: 401,
      });
    },
  );
}

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}

/** Counts the encrypted history rows this browser stores for any identity. */
async function storedHistoryRows(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const countEntries = (name: string): Promise<number> =>
      new Promise((resolve, reject) => {
        const opening = indexedDB.open(name);

        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const database = opening.result;
          const counting = database
            .transaction('entries', 'readonly')
            .objectStore('entries')
            .count();

          counting.onsuccess = () => {
            database.close();
            resolve(counting.result);
          };
          counting.onerror = () => {
            database.close();
            reject(counting.error);
          };
        };
      });
    let rows = 0;

    for (const { name } of await indexedDB.databases()) {
      if (name?.startsWith('pigeon-direct-history')) {
        rows += await countEntries(name);
      }
    }

    return rows;
  });
}
