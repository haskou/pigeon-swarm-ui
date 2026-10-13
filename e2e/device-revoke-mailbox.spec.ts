import { expect, test } from '@playwright/test';

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
  } finally {
    await alicePage.context().close();
    await phone.context().close();
    await laptop.context().close();
  }
});

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}
