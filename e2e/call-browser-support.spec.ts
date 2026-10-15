import { type Page, type Request, expect, test } from '@playwright/test';

import {
  acceptLatestInvitation,
  createDirectConversation,
  newIsolatedPage,
  registerIdentity,
  type TestIdentity,
} from './support/pigeonApp';

// A browser that cannot make a call says why before it asks for the
// microphone or creates a call on the node, so nobody is left ringing.

// Firefox grants its fake microphone; other engines ignore these preferences.
test.use({
  launchOptions: {
    firefoxUserPrefs: {
      'media.navigator.streams.fake': true,
      'permissions.default.microphone': 1,
    },
  },
});

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

test('refuses a private call in a browser that cannot encrypt call media', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Both call media ciphers are removed from desktop Chromium.',
  );
  test.slow();

  const [caller] = await directConversation(browser, async (page) => {
    // A browser with neither RTCRtpScriptTransform nor encoded streams.
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, 'RTCRtpScriptTransform');
      for (const prototype of [
        RTCRtpSender.prototype,
        RTCRtpReceiver.prototype,
      ])
        Reflect.deleteProperty(prototype, 'createEncodedStreams');
    });
  });

  await expectRefusedCall(
    caller,
    /This browser cannot encrypt call audio and video end to end/,
  );
});

test('rings the callee of a private call started in Firefox', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-firefox',
    'Firefox encrypts call media through RTCRtpScriptTransform.',
  );
  test.slow();

  const [caller, callee] = await directConversation(
    browser,
    async () => undefined,
  );
  const callCreated = caller.waitForRequest(isCallCreation);

  await startCall(caller);
  await callCreated;
  await expect(callee.getByText('Incoming call')).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    caller.getByText(/This browser cannot encrypt call audio and video/),
  ).toHaveCount(0);
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

function isCallCreation(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    /\/calls\/?$/.test(new URL(request.url()).pathname)
  );
}

async function startCall(caller: Page) {
  await caller
    .getByRole('button', { name: 'Open conversation menu' })
    .first()
    .click();
  await caller.getByText('Start call', { exact: true }).click();
}

async function expectRefusedCall(caller: Page, reason: RegExp) {
  const callRequests: string[] = [];

  caller.on('request', (request) => {
    if (isCallCreation(request)) callRequests.push(request.url());
  });

  await startCall(caller);

  await expect(caller.getByText(reason).first()).toBeVisible();
  await expect(caller.getByTestId('compact-call-bar')).toHaveCount(0);
  expect(callRequests).toEqual([]);
}

function testRunToken(): string {
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${timestamp}${random}`.toLowerCase();
}
