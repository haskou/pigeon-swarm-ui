import { type Socket, createSocket } from 'node:dgram';
import { isIPv4 } from 'node:net';
import {
  type BrowserContext,
  type Page,
  chromium,
  expect,
  test,
} from '@playwright/test';
import type { CallSignalType } from '../src/contexts/calls/infrastructure/media/CallSignalType';
import type {} from './fixtures/call-session';

// Browsers only learn each other's addresses through relays on the test
// host, so closing every relay takes the media path away, the way a network
// change or a NAT rebinding does. Only candidates signalled after that reach
// the peer again, through new relays.
class MediaPath {
  private readonly sockets = new Set<Socket>();

  private async bind(socket: Socket, address: string): Promise<number> {
    this.sockets.add(socket);
    await new Promise<void>((resolve) => socket.bind(0, address, resolve));

    return socket.address().port;
  }

  public close() {
    for (const socket of this.sockets) socket.close();
    this.sockets.clear();
  }

  // Returns the port that now reaches the candidate's address and port.
  public async relay(address: string, port: number): Promise<number> {
    const listener = createSocket('udp4');
    const upstreams = new Map<string, Socket>();

    listener.on('message', (message, sender) => {
      const key = `${sender.address}:${sender.port}`;
      let upstream = upstreams.get(key);

      if (!upstream) {
        const created = createSocket('udp4');

        created.on('message', (reply) =>
          listener.send(reply, sender.port, sender.address),
        );
        upstreams.set(key, created);
        void this.bind(created, '0.0.0.0');
        upstream = created;
      }
      upstream.send(message, port, address);
    });

    return this.bind(listener, address);
  }
}

async function inspect(page: Page) {
  return page.evaluate(() => window.callSessionTest.inspect());
}

async function expectSingleHealthyConnection(pages: Page[]) {
  for (const page of pages) {
    const state = await inspect(page);

    expect(state.peers).toHaveLength(1);
    expect(state.peers[0].connectionState).toBe('connected');
    expect(state.audioElements).toBe(1);
    expect(state.remoteConnections).toEqual([
      new URL(page.url()).searchParams.get('identity') === 'alice'
        ? 'bob'
        : 'alice',
    ]);
    expect(state.call?.participantIds).toEqual(['alice', 'bob']);
    await expect(
      page.getByRole('button', { name: 'Retry connection' }),
    ).toHaveCount(0);
    await expect(page.getByText('Reconnecting call audio…')).toHaveCount(0);
  }
}

async function expectAudioBothWays(pages: Page[]) {
  const before = await Promise.all(pages.map(inspect));

  await expect
    .poll(
      async () => {
        const after = await Promise.all(pages.map(inspect));

        return after.every(
          (state, index) =>
            (state.peers[0]?.received ?? 0) >
              (before[index].peers[0]?.received ?? 0) + 1000 &&
            (state.peers[0]?.sent ?? 0) >
              (before[index].peers[0]?.sent ?? 0) + 1000,
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

for (const scenario of ['network change', 'backend restart'] as const)
  test(`recovers one connection per participant after a ${scenario}`, async ({
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const path = new MediaPath();
    const browsers = await Promise.all(
      [0, 1].map(() =>
        chromium.launch({
          args: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        }),
      ),
    );
    const contexts: BrowserContext[] = await Promise.all(
      browsers.map((browser) =>
        browser.newContext({ permissions: ['microphone'] }),
      ),
    );
    const signalingErrors: string[] = [];
    let pathDown = false;

    try {
      for (const context of contexts)
        await context.addInitScript(() => {
          localStorage.setItem('pigeon-swarm-language-v2', 'en');
          localStorage.setItem('pigeon-swarm-language-explicit-v3', 'true');
        });

      const pages = await Promise.all(
        contexts.map((context) => context.newPage()),
      );

      for (const [index, page] of pages.entries())
        await page.exposeBinding(
          'sendTestSignal',
          async (
            _source,
            type: CallSignalType,
            original: Record<string, unknown>,
          ) => {
            const payload = { ...original };

            if (type === 'ice_candidate') {
              const fields = String(payload.candidate ?? '').split(' ');

              // Only UDP host candidates on IPv4 are relayed; anything
              // else would let the browsers bypass the controlled path.
              if (
                pathDown ||
                fields[2]?.toLowerCase() !== 'udp' ||
                !isIPv4(fields[4] ?? '')
              )
                return;
              fields[5] = String(
                await path.relay(fields[4], Number(fields[5])),
              );
              payload.candidate = fields.join(' ');
            }
            if (typeof payload.sdp === 'string')
              payload.sdp = payload.sdp
                .split('\r\n')
                .filter(
                  (line) =>
                    !line.startsWith('a=candidate:') &&
                    line !== 'a=end-of-candidates',
                )
                .join('\r\n');
            void pages[1 - index]
              .evaluate(
                ({ type, payload }) =>
                  window.callSessionTest.receive(type, payload),
                { type, payload },
              )
              .catch((error) => signalingErrors.push(String(error)));
          },
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
      await expectAudioBothWays(pages);
      await expectSingleHealthyConnection(pages);

      const before = await Promise.all(pages.map(inspect));

      pathDown = true;
      path.close();
      if (scenario === 'backend restart')
        for (const page of pages)
          await page.evaluate(() =>
            window.callSessionTest.setBackendAvailable(false),
          );
      else for (const context of contexts) await context.setOffline(true);

      await expect
        .poll(
          async () =>
            (await Promise.all(pages.map(inspect))).every(
              (state) => state.peers[0]?.connectionState !== 'connected',
            ),
          { timeout: 30_000 },
        )
        .toBe(true);
      if (scenario === 'backend restart')
        // While the backend is away, signalling and ICE configuration fail,
        // so automatic restarts cannot complete.
        await pages[0].waitForTimeout(10_000);

      pathDown = false;
      if (scenario === 'backend restart')
        for (const page of pages)
          await page.evaluate(() => {
            window.callSessionTest.setBackendAvailable(true);
            // The workspace does this when its realtime socket reconnects.
            window.callSessionTest.recoverRealtime();
          });
      else
        // Coming back online fires the event the call session listens to.
        for (const context of contexts) await context.setOffline(false);

      await expect
        .poll(
          async () =>
            (await Promise.all(pages.map(inspect))).every(
              (state) => state.peers[0]?.connectionState === 'connected',
            ),
          { timeout: 60_000 },
        )
        .toBe(true);

      const after = await Promise.all(pages.map(inspect));

      for (const [index, state] of after.entries())
        expect(state.peers[0]?.iceUfrag).not.toBe(
          before[index].peers[0]?.iceUfrag,
        );
      await expectAudioBothWays(pages);
      await expectSingleHealthyConnection(pages);
      for (const page of pages)
        expect((await inspect(page)).nativePeers).toBe(1);
      expect(signalingErrors).toEqual([]);
    } finally {
      path.close();
      await Promise.all(contexts.map((context) => context.close()));
      await Promise.all(browsers.map((browser) => browser.close()));
    }
  });
