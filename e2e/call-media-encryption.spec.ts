import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
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
  negotiationDelayMs = 0,
): Promise<Page[]> {
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  for (const [index, page] of pages.entries())
    await page.exposeBinding(
      'sendTestSignal',
      async (_source, type: CallSignalType, payload: Record<string, unknown>) =>
        // A held offer or answer reaches the other end only after that end
        // has made an offer of its own, so crossed offers are not left to
        // timing.
        void sleep(type === 'ice_candidate' ? 0 : negotiationDelayMs)
          .then(() =>
            pages[1 - index].evaluate(
              ({ type, payload }) =>
                window.callSessionTest.receive(type, payload),
              { type, payload },
            ),
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

// True when one connection decoded audio across a stretch of time, so it stays
// false while the connection is replaced.
async function decodesAudio(page: Page): Promise<boolean> {
  const [first] = (await inspect(page)).peers;

  await sleep(3_000);

  const [second] = (await inspect(page)).peers;

  if (!first || !second) return false;

  return first.iceUfrag === second.iceUfrag && second.energy > first.energy;
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

    for (const [page, end] of [
      [caller, 'caller'],
      [callee, 'Chromium callee'],
    ] as const)
      expect
        .soft((await remotePeer(page)).energy, `audio the ${end} decoded`)
        .toBe(0);
  });

  test('keeps decoding audio after both ends restart ICE at once', async ({
    baseURL,
  }) => {
    const heldMs = 1_500;
    const key = callKey();
    const pages = await startCall(contexts, baseURL, [key, key], heldMs);

    for (const page of pages)
      await expect
        .poll(async () => (await remotePeer(page)).energy, { timeout: 30_000 })
        .toBeGreaterThan(0);

    // The offers cross; the end that yields must neither lose its encryption
    // nor leave the other end decrypting nothing.
    await Promise.all(
      pages.map((page) =>
        page.evaluate(() => window.callSessionTest.restartIce()),
      ),
    );
    // Audio keeps flowing until the crossed offers are applied, so measure
    // only once the held offers, answers and any re-offer have been delivered.
    await sleep(heldMs * 6);

    for (const page of pages)
      await expect
        .poll(() => decodesAudio(page), { timeout: 30_000 })
        .toBe(true);

    for (const page of pages) {
      const { call } = await inspect(page);
      const peer = await remotePeer(page);

      expect(call?.mediaEncryption).toEqual({ active: true });
      expect(peer.audioTransforms).toEqual({
        receiver: 'RTCRtpScriptTransform',
        sender: 'RTCRtpScriptTransform',
      });
    }
  });
});
