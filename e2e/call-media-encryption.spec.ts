import { randomBytes } from 'node:crypto';
import {
  type Browser,
  type BrowserContext,
  type LaunchOptions,
  type Page,
  chromium,
  expect,
  test,
} from '@playwright/test';
import type { CallSignalType } from '../src/contexts/calls/infrastructure/media/CallSignalType';
import type {} from './fixtures/call-session';

// The caller runs the engine under test; the callee is always Chromium, so
// each engine is checked against another browser. Both ends encrypt every
// audio frame with the call key and drop any frame that key does not decrypt,
// so audio is decoded only when both ends encrypt with the same key.

const chromiumOptions: LaunchOptions = {
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
  ],
  channel: 'chromium',
};

const firefoxOptions: LaunchOptions = {
  firefoxUserPrefs: {
    'media.autoplay.default': 0,
    'media.navigator.streams.fake': true,
    'media.peerconnection.ice.obfuscate_host_addresses': false,
    'permissions.default.microphone': 1,
  },
};

const signalingErrors: string[] = [];

function callKey(): string {
  return randomBytes(32).toString('base64');
}

async function startCall(
  contexts: BrowserContext[],
  baseURL: string | undefined,
  keys: [string, string],
): Promise<Page[]> {
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  for (const [index, page] of pages.entries())
    await page.exposeBinding(
      'sendTestSignal',
      async (_source, type: CallSignalType, payload: Record<string, unknown>) =>
        void pages[1 - index]
          .evaluate(
            ({ type, payload }) =>
              window.callSessionTest.receive(type, payload),
            { type, payload },
          )
          .catch((error) => signalingErrors.push(String(error))),
    );
  await Promise.all(
    pages.map((page, index) =>
      page.goto(
        `${baseURL}/e2e/fixtures/call-session.html?identity=${index === 0 ? 'alice' : 'bob'}&mediaKey=${encodeURIComponent(keys[index])}`,
      ),
    ),
  );
  await Promise.all(
    pages.map((page) =>
      page.waitForFunction(() => Boolean(window.callSessionTest)),
    ),
  );
  await pages[1].evaluate(() => window.callSessionTest.start());
  await pages[0].evaluate(() => window.callSessionTest.start());

  return pages;
}

async function inspect(page: Page) {
  return page.evaluate(() => window.callSessionTest.inspect());
}

async function remotePeer(page: Page) {
  const { peers } = await inspect(page);

  expect(peers).toHaveLength(1);

  return peers[0];
}

test.describe('private call media encryption', () => {
  test.describe.configure({ timeout: 150_000 });

  let browsers: Browser[] = [];
  let contexts: BrowserContext[] = [];

  test.afterEach(async () => {
    await Promise.all(contexts.map((context) => context.close()));
    await Promise.all(browsers.map((browser) => browser.close()));
    browsers = [];
    contexts = [];
    expect(signalingErrors.splice(0)).toEqual([]);
  });

  test.beforeEach(async ({ browserName: engine, playwright }) => {
    // Playwright cannot grant WebKit the microphone, so Safari stays unproven.
    test.skip(engine === 'webkit', 'WebKit cannot be granted a microphone');

    browsers = await Promise.all([
      playwright[engine].launch(
        engine === 'firefox' ? firefoxOptions : chromiumOptions,
      ),
      chromium.launch(chromiumOptions),
    ]);
    contexts = await Promise.all([
      browsers[0].newContext(
        engine === 'chromium' ? { permissions: ['microphone'] } : {},
      ),
      browsers[1].newContext({ permissions: ['microphone'] }),
    ]);
  });

  test('decodes audio both ways when both ends hold the call key', async ({
    baseURL,
  }) => {
    const key = callKey();
    const [caller, callee] = await startCall(contexts, baseURL, [key, key]);

    for (const [page, remote] of [
      [caller, 'bob'],
      [callee, 'alice'],
    ] as const) {
      await expect
        .poll(async () => (await remotePeer(page)).energy, { timeout: 30_000 })
        .toBeGreaterThan(0);
      await expect
        .poll(async () => (await inspect(page)).call?.encryptedWith)
        .toEqual([remote]);

      const { call } = await inspect(page);
      const peer = await remotePeer(page);

      expect(call?.mediaEncryption).toEqual({ active: true });
      expect(peer.connectionState).toBe('connected');
      // Every engine in CI has RTCRtpScriptTransform, so none of them uses
      // the encoded streams kept for older Chromium builds.
      expect(peer.audioTransforms).toEqual({
        receiver: 'RTCRtpScriptTransform',
        sender: 'RTCRtpScriptTransform',
      });
    }
  });

  test('decodes nothing from an end that encrypts with another key', async ({
    baseURL,
  }) => {
    const [caller, callee] = await startCall(contexts, baseURL, [
      callKey(),
      callKey(),
    ]);

    for (const page of [caller, callee])
      await expect
        .poll(async () => (await remotePeer(page)).received, {
          timeout: 30_000,
        })
        .toBeGreaterThan(5_000);

    for (const page of [caller, callee])
      expect((await remotePeer(page)).energy).toBe(0);
  });
});
