import { expect, type Browser, type Page, test } from '@playwright/test';

import {
  acceptLatestInvitation,
  createDirectConversation,
  newIsolatedPage,
  registerIdentity,
  type TestIdentity,
} from './support/pigeonApp';

/**
 * Longer than any read the client caches for signing, so the departure cannot
 * reuse a value a recent request happened to leave behind.
 */
const RINGING_DWELL_MS = 6_000;

test('declines a ringing call when the callee leaves the page', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The call is started from the desktop conversation menu.',
  );
  test.slow();

  const { calleePage, callerPage } = await ringCallee(browser);

  await leaveAndExpectDecline(calleePage, callerPage);
});

test('declines a ringing call when the callee leaves after it rang a while', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The call is started from the desktop conversation menu.',
  );
  test.slow();

  const { calleePage, callerPage } = await ringCallee(browser);

  // A person looks at the ringing call before closing the tab; no request of
  // the callee page is in flight or freshly cached when it leaves.
  await calleePage.waitForTimeout(RINGING_DWELL_MS);

  await leaveAndExpectDecline(calleePage, callerPage);
});

async function ringCallee(
  browser: Browser,
): Promise<{ calleePage: Page; callerPage: Page }> {
  const token = testRunToken();
  const password = `P455uruD3su!${token}`;
  const caller: TestIdentity = {
    handle: `caller${token}`,
    name: `Caller ${token}`,
    password,
  };
  const callee: TestIdentity = {
    handle: `callee${token}`,
    name: `Callee ${token}`,
    password,
  };
  const callerPage = await newIsolatedPage(browser);
  const calleePage = await newIsolatedPage(browser);

  await registerIdentity(calleePage, callee);
  await registerIdentity(callerPage, caller);
  await createDirectConversation(callerPage, callee.handle);
  await acceptLatestInvitation(calleePage);

  await callerPage
    .getByRole('button', { name: 'Open conversation menu' })
    .first()
    .click();
  await callerPage.getByText('Start call', { exact: true }).click();
  await expect(calleePage.getByText('Incoming call')).toBeVisible({
    timeout: 60_000,
  });

  return { calleePage, callerPage };
}

async function leaveAndExpectDecline(
  calleePage: Page,
  callerPage: Page,
): Promise<void> {
  const declineRequest = calleePage.waitForRequest(
    (request) =>
      request.method() === 'DELETE' &&
      /\/calls\/[^/]+\/participants\/me$/.test(new URL(request.url()).pathname),
    { timeout: 30_000 },
  );

  await calleePage.goto('about:blank');

  expect(JSON.parse((await declineRequest).postData() ?? '{}')).toMatchObject({
    mutation: expect.anything(),
  });
  // The node only stores the decline when the signed state matches the one it
  // derives for a ringing participant; a `left` proof is never recorded.
  await expect(callerPage.getByText('Call declined').first()).toBeVisible({
    timeout: 60_000,
  });
}

function testRunToken(): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${timestamp}${random}`.toLowerCase();
}
