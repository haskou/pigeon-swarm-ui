import { type Page, expect, test } from '@playwright/test';

import {
  acceptLatestInvitation,
  createDirectConversation,
  newIsolatedPage,
  registerIdentity,
  type TestIdentity,
} from './support/pigeonApp';

// A browser that cannot make a call says why before it asks for the
// microphone or creates a call on the node, so nobody is left ringing.

test('refuses a call with a clear reason in a browser without WebRTC', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'WebRTC is removed from desktop Chromium, as a browser with it turned off.',
  );
  test.slow();

  const [caller] = await directConversation(browser, async (page) => {
    // Tor Browser and browsers with WebRTC turned off expose none of these.
    await page.addInitScript(() => {
      for (const name of [
        'RTCPeerConnection',
        'webkitRTCPeerConnection',
        'RTCRtpSender',
        'RTCRtpReceiver',
        'RTCSessionDescription',
        'RTCIceCandidate',
      ])
        Reflect.deleteProperty(window, name);
    });
  });

  await expectRefusedCall(
    caller,
    /This browser cannot make calls because WebRTC is turned off or missing/,
  );
});

// Until haskou/pigeon-swarm-ui#474 encrypts call media with
// RTCRtpScriptTransform, Firefox refuses private calls instead of sending
// unencrypted media.
test('refuses a private call in a browser that cannot encrypt call media', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-firefox',
    'Only Firefox lacks the encoded streams used for call encryption here.',
  );
  test.slow();

  const [caller] = await directConversation(browser, async () => undefined);

  await expectRefusedCall(
    caller,
    /This browser cannot encrypt call audio and video end to end/,
  );
});

async function directConversation(
  browser: Parameters<typeof newIsolatedPage>[0],
  prepareCaller: (page: Page) => Promise<void>,
): Promise<[Page, Page]> {
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

  await prepareCaller(callerPage);
  await registerIdentity(calleePage, callee);
  await registerIdentity(callerPage, caller);
  await createDirectConversation(callerPage, callee.handle);
  await acceptLatestInvitation(calleePage);

  return [callerPage, calleePage];
}

async function expectRefusedCall(caller: Page, reason: RegExp) {
  const callRequests: string[] = [];

  caller.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /\/calls\/?$/.test(new URL(request.url()).pathname)
    )
      callRequests.push(request.url());
  });

  await caller
    .getByRole('button', { name: 'Open conversation menu' })
    .first()
    .click();
  await caller.getByText('Start call', { exact: true }).click();

  await expect(caller.getByText(reason).first()).toBeVisible();
  await expect(caller.getByTestId('compact-call-bar')).toHaveCount(0);
  expect(callRequests).toEqual([]);
}

function testRunToken(): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${timestamp}${random}`.toLowerCase();
}
