import { expect, type Locator, type Page, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import {
  acceptLatestInvitation,
  createDirectConversation,
  newIsolatedPage,
  openSecurityProfile,
  registerIdentity,
  selectConversationByTitle,
  sendMessage,
  type TestIdentity,
  waitForWorkspace,
} from './support/pigeonApp';

test('signs in with the recovery key on a new device after the identity saved conversation keys, and its backup still restores', async ({
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
  const recoveredPage = await newIsolatedPage(browser);

  try {
    const recoveryKey = await registerIdentity(alicePage, alice);

    await registerIdentity(bobPage, bob);

    // One conversation stores its key in Alice's keychain, so the identity
    // has a keychain head sealed under the root only her devices hold.
    await createDirectConversation(alicePage, bob.handle);
    await acceptLatestInvitation(bobPage);
    await selectConversationByTitle(alicePage, bob.name);
    await selectConversationByTitle(bobPage, alice.name);
    await sendMessage(bobPage, bobMessage);
    await expect(alicePage.getByText(bobMessage, { exact: true })).toBeVisible({
      timeout: 45_000,
    });
    await sendMessage(alicePage, aliceMessage);
    await expect(bobPage.getByText(aliceMessage, { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    const backup = await exportHistoryBackup(alicePage, password);

    // A fresh device recovers with the key. Before confirming, it says the
    // keys of the old conversations are lost.
    await recoveredPage.goto('/');
    await recoveredPage
      .getByTestId('auth-identity-input')
      .fill(`@${alice.handle}`);
    await recoveredPage
      .getByTestId('auth-login-method-control')
      .getByRole('button', { name: 'Recovery key' })
      .click();
    await expect(
      recoveredPage.getByTestId('auth-recovery-key-loss'),
    ).toContainText('must invite you again');
    await recoveredPage
      .getByTestId('auth-recovery-key-input')
      .fill(recoveryKey);
    await recoveredPage.getByTestId('auth-password-input').fill(password);
    await recoveredPage
      .getByTestId('auth-password-confirmation-input')
      .fill(password);
    await recoveredPage.getByTestId('auth-submit-button').click();
    await waitForWorkspace(recoveredPage);

    // The backup made before the recovery opens on the recovered device: its
    // key comes from the identity root, which the recovery key restores.
    const panel = await openHistoryBackup(recoveredPage);

    await panel.getByTestId('history-backup-file').setInputFiles({
      buffer: backup,
      mimeType: 'application/json',
      name: 'pigeon-swarm-backup.json',
    });
    await expect(panel.getByRole('status')).toHaveText(
      'History and contacts restored.',
      { timeout: 30_000 },
    );
  } finally {
    await alicePage.context().close();
    await bobPage.context().close();
    await recoveredPage.context().close();
  }
});

async function exportHistoryBackup(
  page: Page,
  password: string,
): Promise<Buffer> {
  const panel = await openHistoryBackup(page);

  await panel.locator('input[type="password"]').fill(password);
  const downloading = page.waitForEvent('download');

  await panel.getByTestId('history-backup-export').click();
  const download = await downloading;

  await expect(panel.getByRole('status')).toHaveText('Backup saved.');

  return await readFile(await download.path());
}

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

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}
