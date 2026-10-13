import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  acceptLatestInvitation,
  createDirectConversation,
  loginIdentity,
  newIsolatedPage,
  registerIdentity,
  selectConversationByTitle,
  sendMessage,
  type TestIdentity,
} from './support/pigeonApp';

test('delivers a send queued while the recipient inbox is absent, after a reload', async ({
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
  const queuedMessage = `queued for bob ${token}`;
  const alicePage = await newIsolatedPage(browser);
  const bobPage = await newIsolatedPage(browser);

  try {
    await registerIdentity(alicePage, alice);
    await registerIdentity(bobPage, bob);

    // Bob has not accepted the invitation yet, so his inbox for this
    // conversation does not exist and Alice's append to it is refused.
    await createDirectConversation(alicePage, bob.handle);
    await selectConversationByTitle(alicePage, bob.name);
    await sendMessage(alicePage, queuedMessage);
    await expect(retrying(alicePage)).toBeVisible({ timeout: 45_000 });

    // The reload drops the session. Signing in again resumes the outbox, and
    // the send stays visible with its retry state.
    await alicePage.reload();
    await loginIdentity(alicePage, alice.handle, password);
    await selectConversationByTitle(alicePage, bob.name);
    await expect(
      alicePage.getByText(queuedMessage, { exact: true }),
    ).toBeVisible({ timeout: 45_000 });
    await expect(retrying(alicePage)).toBeVisible({ timeout: 45_000 });

    // Accepting opens Bob's inbox. Alice's queued send then lands on its next
    // attempt, which is at most a minute away once the first 30 seconds pass.
    await acceptLatestInvitation(bobPage);
    await selectConversationByTitle(bobPage, alice.name);
    await expect(bobPage.getByText(queuedMessage, { exact: true })).toBeVisible(
      { timeout: 90_000 },
    );
    await expect(bobPage.getByText(queuedMessage, { exact: true })).toHaveCount(
      1,
    );

    // A delivered send clears its retry state and stays in Alice's timeline.
    await expect(retrying(alicePage)).toHaveCount(0, { timeout: 30_000 });
    await expect(
      alicePage.getByText(queuedMessage, { exact: true }),
    ).toBeVisible();
  } finally {
    await alicePage.context().close();
    await bobPage.context().close();
  }
});

function retrying(page: Page): Locator {
  return page.getByText('Retrying', { exact: true });
}

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}
