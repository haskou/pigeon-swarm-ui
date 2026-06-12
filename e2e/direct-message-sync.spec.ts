import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  acceptLatestInvitation,
  conversationRow,
  createDirectConversation,
  newIsolatedPage,
  registerIdentity,
  selectConversationByTitle,
  sendMessage,
  updateOwnProfileBanner,
  waitForConversationBannerChange,
  type TestIdentity,
} from './support/pigeonApp';

test('syncs direct messages and peer banner updates across devices', async ({
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
  const aliceMessage = `hello from alice ${token}`;
  const bobMessage = `hello from bob ${token}`;
  const bannerFixture = path.resolve(process.cwd(), 'public/logo.png');
  const alicePage = await newIsolatedPage(browser);
  const bobPage = await newIsolatedPage(browser);

  try {
    await registerIdentity(alicePage, alice);
    await registerIdentity(bobPage, bob);

    await createDirectConversation(alicePage, bob.handle);
    await acceptLatestInvitation(bobPage);

    await selectConversationByTitle(alicePage, bob.name);
    await selectConversationByTitle(bobPage, alice.name);

    await sendMessage(alicePage, aliceMessage);
    await expect(bobPage.getByText(aliceMessage, { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    await sendMessage(bobPage, bobMessage);
    await expect(alicePage.getByText(bobMessage, { exact: true })).toBeVisible({
      timeout: 45_000,
    });

    const aliceConversationOnBob = conversationRow(bobPage, alice.name);
    const previousBannerUrl =
      await aliceConversationOnBob.getAttribute('data-banner-url');

    await updateOwnProfileBanner(alicePage, bannerFixture);
    await waitForConversationBannerChange(
      bobPage,
      alice.name,
      previousBannerUrl,
    );
  } finally {
    await alicePage.context().close();
    await bobPage.context().close();
  }
});

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}
