import { expect, type Locator, type Page, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import {
  acceptLatestInvitation,
  createDirectConversation,
  loginIdentity,
  newIsolatedPage,
  openSecurityProfile,
  registerIdentity,
  selectConversationByTitle,
  sendMessage,
  type TestIdentity,
} from './support/pigeonApp';

const ENVELOPES_PATH = /\/mailboxes\/[^/]+\/envelopes$/;

test('backs up after the password is confirmed again and restores on the same identity only', async ({
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
  const aliceMessage = `hello from alice ${token}`;
  const alicePage = await newIsolatedPage(browser);
  const bobPage = await newIsolatedPage(browser);
  const restored = await newIsolatedPage(browser);

  try {
    const recoveryKey = await registerIdentity(alicePage, alice);

    await registerIdentity(bobPage, bob);
    await createDirectConversation(alicePage, bob.handle);
    await acceptLatestInvitation(bobPage);
    await selectConversationByTitle(alicePage, bob.name);
    await selectConversationByTitle(bobPage, alice.name);

    // Bob sends first, so both inboxes are open before Alice sends.
    await sendMessage(bobPage, bobMessage);
    await expect(alicePage.getByText(bobMessage, { exact: true })).toBeVisible({
      timeout: 45_000,
    });
    await sendMessage(alicePage, aliceMessage);
    await expect(bobPage.getByText(aliceMessage, { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    // A wrong password exports nothing.
    const downloads: string[] = [];

    alicePage.on('download', (download) => {
      downloads.push(download.suggestedFilename());
    });

    const aliceBackup = await openHistoryBackup(alicePage);

    await aliceBackup
      .locator('input[type="password"]')
      .fill(`${password}wrong`);
    await aliceBackup.getByTestId('history-backup-export').click();
    await expect(aliceBackup.getByRole('alert')).toHaveText(
      'Your password or passkey could not be confirmed.',
    );
    expect(downloads).toEqual([]);

    // The right password exports one file that shows neither the messages
    // nor the identity in the clear.
    await aliceBackup.locator('input[type="password"]').fill(password);
    const downloading = alicePage.waitForEvent('download');

    await aliceBackup.getByTestId('history-backup-export').click();
    const download = await downloading;

    await expect(aliceBackup.getByRole('status')).toHaveText('Backup saved.');
    expect(download.suggestedFilename()).toMatch(
      /^pigeon-swarm-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const file = await readFile(await download.path());
    const text = file.toString('utf8');

    expect(downloads).toHaveLength(1);
    expect(JSON.parse(text)).toMatchObject({
      format: 'pigeon-swarm-backup',
      version: 1,
    });
    for (const secret of [bobMessage, aliceMessage, alice.handle, bob.handle]) {
      expect(text).not.toContain(secret);
    }
    await alicePage.context().close();

    // Another identity cannot open the file and stores nothing from it.
    const bobBackup = await openHistoryBackup(bobPage);

    await restoreFile(bobBackup, file);
    await expect(bobBackup.getByRole('alert')).toHaveText(
      'This file is not a backup of this identity, or it was changed.',
    );

    // A new device of the same identity, signed in with the recovery key,
    // starts without the history. The node serves it no envelopes, as after
    // its retention expired, so only the backup can bring the history back.
    await serveNoEnvelopes(restored);
    await loginIdentity(restored, `@${alice.handle}`, password, recoveryKey);
    await selectConversationByTitle(restored, bob.name);
    await expect(restored.getByTestId('message-composer-input')).toBeEnabled({
      timeout: 30_000,
    });
    await expect(restored.getByText(bobMessage, { exact: true })).toHaveCount(
      0,
    );
    await expect(restored.getByText(aliceMessage, { exact: true })).toHaveCount(
      0,
    );

    // A changed byte is refused before anything is stored.
    const restoredBackup = await openHistoryBackup(restored);

    await restoreFile(restoredBackup, tampered(text));
    await expect(restoredBackup.getByRole('alert')).toHaveText(
      'This file is not a backup of this identity, or it was changed.',
    );

    await restoreFile(restoredBackup, file);
    await expect(restoredBackup.getByRole('status')).toHaveText(
      'History and contacts restored.',
      { timeout: 30_000 },
    );

    // The restored history is stored on this device: it shows after a new
    // sign-in, still without any envelope from the node.
    await loginIdentity(restored, `@${alice.handle}`, password);
    await selectConversationByTitle(restored, bob.name);
    await expect(restored.getByText(bobMessage, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(restored.getByText(aliceMessage, { exact: true })).toBeVisible(
      { timeout: 30_000 },
    );
  } finally {
    await alicePage.context().close();
    await bobPage.context().close();
    await restored.context().close();
  }
});

/**
 * Opens Profile → Security, expands "Storage on this device", which starts
 * collapsed, and returns the backup panel inside it.
 */
async function openHistoryBackup(page: Page): Promise<Locator> {
  await openSecurityProfile(page);

  const storage = page.locator('button[aria-controls="device-storage-panel"]');

  await storage.scrollIntoViewIfNeeded();
  await storage.click();
  await expect(storage).toHaveAttribute('aria-expanded', 'true');

  const panel = page.getByTestId('history-backup');

  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toBeVisible();

  return panel;
}

async function restoreFile(panel: Locator, file: Buffer): Promise<void> {
  await panel.getByTestId('history-backup-file').setInputFiles({
    buffer: file,
    mimeType: 'application/json',
    name: 'pigeon-swarm-backup.json',
  });
}

/** The backup with one ciphertext character changed. */
function tampered(text: string): Buffer {
  const backup = JSON.parse(text) as { ciphertext: string };
  const middle = Math.floor(backup.ciphertext.length / 2);
  const original = backup.ciphertext[middle];
  const changed = original === 'A' ? 'B' : 'A';

  return Buffer.from(
    JSON.stringify({
      ...backup,
      ciphertext: `${backup.ciphertext.slice(0, middle)}${changed}${backup.ciphertext.slice(middle + 1)}`,
    }),
  );
}

/** Answers every mailbox read with an empty page; sends go through. */
async function serveNoEnvelopes(page: Page): Promise<void> {
  await page.route(
    (url) => ENVELOPES_PATH.test(url.pathname),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();

      return route.fulfill({ json: { envelopes: [], hasMore: false } });
    },
  );
}

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}
