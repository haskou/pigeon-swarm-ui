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

// The caller runs the engine under test; the callee is always Chromium with a
// fake microphone, so every engine is checked against a working peer.

type Engine = 'chromium' | 'firefox' | 'webkit';
type Permission = 'denied' | 'granted';

// The headless shell cannot show a permission prompt and fails capture with
// NotSupportedError; the full build denies it like a desktop browser does.
const chromiumOptions: LaunchOptions = {
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    // A peer without microphone permission hides its host address behind
    // mDNS, which a CI runner cannot always resolve.
    '--disable-features=WebRtcHideLocalIpsWithMdns',
  ],
  channel: 'chromium',
};

function launchOptions(engine: Engine, permission: Permission): LaunchOptions {
  if (engine === 'firefox')
    return {
      firefoxUserPrefs: {
        'media.autoplay.default': 0,
        'media.navigator.streams.fake': true,
        'media.peerconnection.ice.obfuscate_host_addresses': false,
        // 1 allows and 2 blocks the microphone without a prompt.
        'permissions.default.microphone': permission === 'granted' ? 1 : 2,
      },
    };
  if (engine === 'chromium') return chromiumOptions;

  return {};
}

// Playwright cannot grant or deny the microphone on WebKit, whose capture
// prompt never settles headless, so WebKit gets a generated tone and the
// browser errors are raised with the names WebKit reports.
type MicrophoneFailure = 'NotAllowedError' | 'NotFoundError' | null;
type MicrophoneControl = {
  failure: MicrophoneFailure;
  warmCapture?: MediaStream;
  warmUp: () => Promise<void>;
};

async function controlMicrophone(
  context: BrowserContext,
  engine: Engine,
  failure: MicrophoneFailure,
) {
  await context.addInitScript(
    ({ failure, synthetic }) => {
      const devices = navigator.mediaDevices;
      const getUserMedia = devices.getUserMedia.bind(devices);
      const enumerateDevices = devices.enumerateDevices.bind(devices);
      const state: MicrophoneControl = {
        failure,
        // Chromium's first fake capture can take tens of seconds on a loaded
        // host; opening it before a plug-in keeps the app's retry the subject.
        // The capture stays referenced: once collected, Chromium ends the
        // shared fake source and with it the track the call is sending.
        warmUp: async () => {
          if (!synthetic)
            state.warmCapture = await getUserMedia({ audio: true });
        },
      };

      window.microphoneTest = state;
      devices.getUserMedia = async (constraints) => {
        if (state.failure)
          throw new DOMException('Microphone unavailable', state.failure);
        if (!synthetic) return getUserMedia(constraints);

        const audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const destination = audio.createMediaStreamDestination();

        oscillator.connect(destination);
        oscillator.start();

        return destination.stream;
      };
      devices.enumerateDevices = async () =>
        (await enumerateDevices()).filter(
          (device) =>
            device.kind !== 'audioinput' || state.failure !== 'NotFoundError',
        );
    },
    { failure, synthetic: engine === 'webkit' },
  );
}

async function setMicrophoneFailure(page: Page, failure: MicrophoneFailure) {
  await page.evaluate(async (failure) => {
    if (!window.microphoneTest) throw new Error('Microphone is not controlled');

    if (!failure) await window.microphoneTest.warmUp();
    window.microphoneTest.failure = failure;
    // Plugging or unplugging a device fires devicechange in every engine.
    navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
  }, failure);
}

const signalingErrors: string[] = [];

async function startCall(
  callerContext: BrowserContext,
  calleeContext: BrowserContext,
  baseURL: string | undefined,
): Promise<[Page, Page]> {
  const contexts = [callerContext, calleeContext];

  for (const context of contexts)
    await context.addInitScript(() => {
      localStorage.setItem('pigeon-swarm-language-v2', 'en');
      localStorage.setItem('pigeon-swarm-language-explicit-v3', 'true');
    });

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
        `${baseURL}/e2e/fixtures/call-session.html?identity=${index === 0 ? 'alice' : 'bob'}`,
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

  return [pages[0], pages[1]];
}

async function received(page: Page): Promise<number> {
  const { peers } = await page.evaluate(() => window.callSessionTest.inspect());

  return peers[0]?.received ?? 0;
}

// The receiver hears the other side through exactly one peer, one audio
// element and one media connection, whatever the caller's microphone did.
async function expectAudioReceivedBy(receiver: Page) {
  const before = await received(receiver);

  await expect
    .poll(() => received(receiver), { timeout: 30_000 })
    .toBeGreaterThan(before + 1000);

  const { peers, audioElements, remoteConnections, call } =
    await receiver.evaluate(() => window.callSessionTest.inspect());

  expect(peers).toHaveLength(1);
  expect(audioElements).toBe(1);
  expect(remoteConnections).toEqual([
    new URL(receiver.url()).searchParams.get('identity') === 'alice'
      ? 'bob'
      : 'alice',
  ]);
  expect(call?.participantIds).toEqual(['alice', 'bob']);
}

async function expectMicrophoneNotice(page: Page, reason: RegExp) {
  const bar = page.getByTestId('compact-call-bar');

  await expect(bar).toContainText('Cannot use microphone');
  await expect(bar).toContainText(reason);
}

async function expectNoMicrophoneNotice(page: Page) {
  await expect(
    page.getByTestId('compact-call-bar').getByText('Cannot use microphone'),
  ).toHaveCount(0);
}

const deniedText = /has not granted microphone permission/;
const missingText = /No microphone was found/;

test.describe('call microphone availability', () => {
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

  async function open(
    engine: Engine,
    permission: Permission,
    launch: (options: LaunchOptions) => Promise<Browser>,
  ) {
    browsers = await Promise.all([
      launch(launchOptions(engine, permission)),
      chromium.launch(chromiumOptions),
    ]);
    contexts = await Promise.all([
      browsers[0].newContext(
        engine === 'chromium' && permission === 'granted'
          ? { permissions: ['microphone'] }
          : {},
      ),
      browsers[1].newContext({ permissions: ['microphone'] }),
    ]);

    return contexts;
  }

  test('joins without a denied microphone and attaches it once allowed', async ({
    baseURL,
    browserName: engine,
    playwright,
  }) => {
    const [callerContext, calleeContext] = await open(
      engine,
      'denied',
      (options) => playwright[engine].launch(options),
    );

    await controlMicrophone(
      callerContext,
      engine,
      engine === 'webkit' ? 'NotAllowedError' : null,
    );

    const [caller, callee] = await startCall(
      callerContext,
      calleeContext,
      baseURL,
    );

    await expectMicrophoneNotice(caller, deniedText);
    await expectAudioReceivedBy(caller);
    expect(
      (await caller.evaluate(() => window.callSessionTest.inspect())).call,
    ).toMatchObject({ hasMicrophone: false, microphoneError: 'denied' });
    expect(await received(callee)).toBe(0);
    // A denial offers one action, the one that asks the browser again.
    await expect(
      caller.getByRole('button', { name: 'Retry', exact: true }),
    ).toHaveCount(0);

    const allow = caller.getByRole('button', {
      exact: true,
      name: 'Allow microphone',
    });

    if (engine === 'firefox') {
      // A blocked site permission stays blocked: asking again keeps the reason.
      await allow.click();
      await expectMicrophoneNotice(caller, deniedText);

      return;
    }

    if (engine === 'chromium') {
      // The device disappears while permission is still pending, so the
      // automatic retry after the grant reports the new, distinct reason.
      await setMicrophoneFailure(caller, 'NotFoundError');
      await callerContext.grantPermissions(['microphone']);
      await expectMicrophoneNotice(caller, missingText);
      await setMicrophoneFailure(caller, null);
    } else {
      await setMicrophoneFailure(caller, null);
      await allow.click();
    }

    await expectNoMicrophoneNotice(caller);
    await expectAudioReceivedBy(callee);
  });

  test('joins without a missing microphone and attaches it once connected', async ({
    baseURL,
    browserName: engine,
    playwright,
  }) => {
    const [callerContext, calleeContext] = await open(
      engine,
      'granted',
      (options) => playwright[engine].launch(options),
    );

    await controlMicrophone(callerContext, engine, 'NotFoundError');

    const [caller, callee] = await startCall(
      callerContext,
      calleeContext,
      baseURL,
    );

    await expectMicrophoneNotice(caller, missingText);
    await expectAudioReceivedBy(caller);
    expect(
      (await caller.evaluate(() => window.callSessionTest.inspect())).call,
    ).toMatchObject({
      hasMicrophone: false,
      microphoneError: 'missing-device',
    });
    await setMicrophoneFailure(caller, null);

    // WebKit reports the permission as not granted, so connecting a device
    // waits for the user to retry instead of prompting by itself.
    if (engine === 'webkit')
      await caller.getByRole('button', { name: 'Retry', exact: true }).click();

    await expectNoMicrophoneNotice(caller);
    await expectAudioReceivedBy(callee);
  });
});

declare global {
  interface Window {
    microphoneTest?: MicrophoneControl;
  }
}
