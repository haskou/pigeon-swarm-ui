import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';
import { expect, type Page, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

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

    // On its next sign-in the laptop reads the signed transitions, verifies
    // the revocation the phone signed, and erases what it stored for Bob.
    await signIn(laptop, bob);
    await expect(
      laptop.getByText('This device was removed from your account.'),
    ).toBeVisible({ timeout: 45_000 });
    await expect(
      laptop.getByText('were erased from this browser', { exact: false }),
    ).toBeVisible();
    await expect.poll(() => storedHistoryRows(laptop)).toBe(0);
    await laptop.goto('/');
    await expect(laptop.getByTestId('auth-identity-preview')).toHaveCount(0);

    // A node can refuse the read or forge a removal of a device that is still
    // authorized. Neither is a signed removal, so the phone erases nothing.
    await expect.poll(() => storedHistoryRows(phone)).toBeGreaterThan(0);
    for (const [forgery, refusal] of [
      [refuseTransitions, 'The signed request was rejected.'],
      [
        forgeRevocation,
        'This node could not prove that this device is still authorized.',
      ],
    ] as const) {
      await forgery(phone);
      await signIn(phone, bob);
      await expect(phone.getByText(refusal, { exact: false })).toBeVisible({
        timeout: 45_000,
      });
      await expect(
        phone.getByText('This device was removed from your account.'),
      ).toHaveCount(0);
      expect(await storedHistoryRows(phone)).toBeGreaterThan(0);
      await phone.unrouteAll();
    }
  } finally {
    await alicePage.context().close();
    await phone.context().close();
    await laptop.context().close();
  }
});

/**
 * Signs in with the password. Both devices last signed in as this identity, so
 * the login screen replaces the identity input with the remembered identity.
 */
async function signIn(page: Page, identity: TestIdentity): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('auth-identity-preview')).toContainText(
    `@${identity.handle}`,
    { timeout: 30_000 },
  );
  await page.getByTestId('auth-password-input').fill(identity.password);
  await page.getByTestId('auth-submit-button').click();
}

const TRANSITIONS_PATH = /\/identity-devices\/[^/]+\/transitions$/;

/** Rejects the device-signed transition read, as a lying node could. */
async function refuseTransitions(page: Page): Promise<void> {
  await page.route(
    (url) => TRANSITIONS_PATH.test(url.pathname),
    (route) =>
      route.fulfill({
        json: { code: 401020, message: 'Invalid signed request' },
        status: 401,
      }),
  );
}

/**
 * Serves the genuine transitions plus a revocation of this device that reuses
 * the signature of the real revocation: a removal no authorized key signed.
 */
async function forgeRevocation(page: Page): Promise<void> {
  await page.route(
    (url) => TRANSITIONS_PATH.test(url.pathname),
    async (route) => {
      const response = await route.fetch();
      const log = (await response.json()) as {
        transitions: Array<Record<string, unknown>>;
      };
      const revocation = log.transitions.find(
        (transition) => transition.operation === 'revoke',
      );

      if (!revocation) throw new Error('No revocation to forge from.');

      const head = log.transitions.length;
      const self = String(revocation.authorCredential);

      await route.fulfill({
        json: {
          ...log,
          transitions: [
            ...log.transitions,
            {
              ...revocation,
              operationId: randomUUID(),
              previousRevision: head,
              revision: head + 1,
              targetCredential: self,
              targetCredentialCommitment: SHA256Hash.from(
                new StringValueObject(self),
              ).valueOf(),
            },
          ],
        },
        response,
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
