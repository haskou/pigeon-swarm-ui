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
  waitForSettledLoginScreen,
  type TestIdentity,
} from './support/pigeonApp';

// How often a signed-in device re-reads its signed transitions, as
// DeviceRemovalWatch.CHECK_INTERVAL_MS, plus slack for the read itself.
const REMOVAL_CHECK_BOUND_MS = 30_000;
const REMOVAL_CHECK_SLACK_MS = 15_000;
// How long each reader removal is held, so the cut-off of the revoked device
// lags well behind the revoke, as on a slow link.
const READER_REMOVAL_DELAY_MS = 8_000;

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

    // While its transition reads are refused, the revoked laptop cannot prove
    // the revoke, so it stays signed in and keeps syncing, yet the revoke is
    // reported done only once the laptop is cut off, so a message sent right
    // after it never reaches the laptop, however slow the cut-off is.
    const refusedReads = await refuseTransitions(laptop);
    await slowReaderRemovals(phone);
    await revokeOtherDevice(phone);
    await phone.getByRole('button', { name: 'Close dialog' }).last().click();
    await selectConversationByTitle(phone, alice.name);

    await sendMessage(alicePage, afterRevoke);
    await expect(phone.getByText(afterRevoke, { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    const refusedBefore = refusedReads.count;
    await laptop.waitForTimeout(
      REMOVAL_CHECK_BOUND_MS + REMOVAL_CHECK_SLACK_MS,
    );
    expect(refusedReads.count).toBeGreaterThan(refusedBefore);
    await expect(laptop.getByText(beforeRevoke, { exact: true })).toBeVisible();
    await expect(laptop.getByText(afterRevoke, { exact: true })).toHaveCount(0);
    await expect(
      laptop.getByText('This device was removed from your account.'),
    ).toHaveCount(0);
    await expect.poll(() => storedHistoryRows(laptop)).toBeGreaterThan(0);
    await phone.unrouteAll({ behavior: 'wait' });

    // Once the read goes through, the still signed-in laptop verifies the
    // revocation the phone signed within the bound, erases what it stored
    // for Bob, and falls back to the login screen.
    await laptop.unrouteAll({ behavior: 'wait' });
    await expect(
      laptop.getByText('This device was removed from your account.'),
    ).toBeVisible({ timeout: REMOVAL_CHECK_BOUND_MS + REMOVAL_CHECK_SLACK_MS });
    await expect(
      laptop.getByText('were erased from this browser', { exact: false }),
    ).toBeVisible();
    await expect.poll(() => storedHistoryRows(laptop)).toBe(0);
    await laptop.goto('/');
    await waitForSettledLoginScreen(laptop);
    await expect(laptop.getByTestId('auth-identity-preview')).toHaveCount(0);

    // A node can refuse the read or forge a removal of a device that is still
    // authorized. Neither is a signed removal, so the phone erases nothing,
    // whether it is signed in or signing in.
    await expect.poll(() => storedHistoryRows(phone)).toBeGreaterThan(0);
    const forgedReads = await forgeRevocation(phone);
    await phone.waitForTimeout(REMOVAL_CHECK_BOUND_MS + REMOVAL_CHECK_SLACK_MS);
    expect(forgedReads.count).toBeGreaterThan(0);
    await expect(
      phone.getByText('This device was removed from your account.'),
    ).toHaveCount(0);
    await expect(phone.getByText(afterRevoke, { exact: true })).toBeVisible();
    expect(await storedHistoryRows(phone)).toBeGreaterThan(0);
    await phone.unrouteAll({ behavior: 'wait' });

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

const READER_PATH = /\/mailboxes\/[^/]+\/readers\/[^/]+$/;

/** Holds every reader removal of the page before letting it through. */
async function slowReaderRemovals(page: Page): Promise<void> {
  await page.route(
    (url) => READER_PATH.test(url.pathname),
    async (route) => {
      if (route.request().method() === 'DELETE') {
        await page.waitForTimeout(READER_REMOVAL_DELAY_MS);
      }

      await route.fallback();
    },
  );
}

const TRANSITIONS_PATH = /\/identity-devices\/[^/]+\/transitions$/;

/**
 * Rejects the device-signed transition read, as a lying node could. Counts
 * the reads it rejected.
 */
async function refuseTransitions(page: Page): Promise<{ count: number }> {
  const reads = { count: 0 };

  await page.route(
    (url) => TRANSITIONS_PATH.test(url.pathname),
    (route) => {
      reads.count += 1;

      return route.fulfill({
        json: { code: 401020, message: 'Invalid signed request' },
        status: 401,
      });
    },
  );

  return reads;
}

/**
 * Serves the genuine transitions plus a revocation of this device that reuses
 * the signature of the real revocation: a removal no authorized key signed.
 * Counts the reads it forged.
 */
async function forgeRevocation(page: Page): Promise<{ count: number }> {
  const reads = { count: 0 };

  await page.route(
    (url) => TRANSITIONS_PATH.test(url.pathname),
    async (route) => {
      reads.count += 1;

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

  return reads;
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
