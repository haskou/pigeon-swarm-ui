import { chromium, expect, test } from '@playwright/test';
import type { CallSignalType } from '../src/contexts/calls/infrastructure/media/CallSignalType';
import type {} from './fixtures/call-recovery';

for (const scenario of [
  'normal',
  'single-restart',
  'simultaneous-restart',
  'connected-restart',
  'exhausted-retry',
])
  test(`exchanges real browser audio after ${scenario}`, async ({
    baseURL,
  }) => {
    test.setTimeout(150_000);
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
    const contexts = await Promise.all(
      browsers.map((browser) =>
        browser.newContext({ permissions: ['microphone'] }),
      ),
    );
    for (const context of contexts)
      await context.addInitScript(() => {
        localStorage.setItem('pigeon-swarm-language-v2', 'en');
        localStorage.setItem('pigeon-swarm-language-explicit-v3', 'true');
      });
    for (const context of contexts)
      await context.routeWebSocket('**/*', (socket) => socket.close());
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    let blockCandidates = !['normal', 'connected-restart'].includes(scenario);
    const signalingErrors: string[] = [];
    let collideOffers = false;
    const collisionSignals: Array<{
      index: number;
      type: CallSignalType;
      payload: Record<string, unknown>;
    }> = [];
    const deliver = (
      index: number,
      type: CallSignalType,
      payload: Record<string, unknown>,
    ) => {
      void pages[1 - index]
        .evaluate(
          ({ type, payload }) => window.callRecoveryTest.receive(type, payload),
          { type, payload },
        )
        .catch((error) => signalingErrors.push(String(error)));
    };
    for (const [index, page] of pages.entries()) {
      await page.exposeBinding(
        'sendTestSignal',
        async (
          _source,
          type: CallSignalType,
          original: Record<string, unknown>,
        ) => {
          if (blockCandidates && type === 'ice_candidate') return;
          const payload = { ...original };
          if (blockCandidates && typeof payload.sdp === 'string')
            payload.sdp = payload.sdp
              .split('\r\n')
              .filter(
                (line) =>
                  !line.startsWith('a=candidate:') &&
                  line !== 'a=end-of-candidates',
              )
              .join('\r\n');
          if (collideOffers) {
            collisionSignals.push({ index, type, payload });
            if (
              collisionSignals.filter((signal) => signal.type === 'offer')
                .length < 2
            )
              return;
            collideOffers = false;
            for (const signal of collisionSignals.filter(
              (signal) => signal.type === 'offer',
            ))
              deliver(signal.index, signal.type, signal.payload);
            for (const signal of collisionSignals.filter(
              (signal) => signal.type !== 'offer',
            ))
              deliver(signal.index, signal.type, signal.payload);
            return;
          }
          if (type === 'answer' && collisionSignals.length > 0) {
            const candidates = await page.evaluate(() =>
              window.callRecoveryTest.candidates(),
            );
            expect(candidates.length).toBeGreaterThan(0);
            for (const candidate of candidates)
              await pages[1 - index].evaluate(
                (candidate) =>
                  window.callRecoveryTest.receive('ice_candidate', {
                    ...candidate,
                  }),
                candidate,
              );
            payload.sdp = String(payload.sdp)
              .split('\r\n')
              .filter(
                (line) =>
                  !line.startsWith('a=candidate:') &&
                  line !== 'a=end-of-candidates',
              )
              .join('\r\n');
          }
          deliver(index, type, payload);
        },
      );
    }
    try {
      await Promise.all(
        pages.map((page, index) =>
          page.goto(
            `${baseURL}/e2e/fixtures/call-recovery.html?identity=${index === 0 ? 'alice' : 'bob'}`,
          ),
        ),
      );
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(() => Boolean(window.callRecoveryTest)),
        ),
      );
      await pages[1].evaluate(() => window.callRecoveryTest.start(false));
      await pages[0].evaluate(() => window.callRecoveryTest.start(true));
      for (const page of pages)
        await expect
          .poll(
            async () =>
              (await page.evaluate(() => window.callRecoveryTest.inspect()))
                .native[0],
            { timeout: 10_000 },
          )
          .toMatchObject({ signalingState: 'stable', hasDescriptions: true });
      if (scenario === 'exhausted-retry') {
        await expect
          .poll(
            async () =>
              (await pages[0].evaluate(() => window.callRecoveryTest.inspect()))
                .stats.bob,
            { timeout: 5000 },
          )
          .toMatchObject({ iceState: 'new', recoveryState: 'recovering' });
        await expect(pages[0].getByRole('status')).toContainText(
          'Reconnecting',
          {
            timeout: 30_000,
          },
        );
        await expect(
          pages[0].getByRole('button', {
            name: 'Retry connection',
            exact: true,
          }),
        ).toBeVisible({ timeout: 90_000 });
        const exhausted = await pages[0].evaluate(() =>
          window.callRecoveryTest.inspect(),
        );
        expect(exhausted.configurationRequests).toBe(4);
        expect(exhausted.stats.bob.recoveryState).toBe('exhausted');
        await pages[0]
          .getByRole('button', { name: 'Start diagnostics', exact: true })
          .click();
        blockCandidates = false;
        await pages[0]
          .getByRole('button', { name: 'Retry connection', exact: true })
          .click();
      } else {
        await pages[0]
          .getByRole('button', { name: 'Start diagnostics', exact: true })
          .click();
        if (scenario === 'single-restart') {
          blockCandidates = false;
          await pages[0].evaluate(() => window.callRecoveryTest.restart());
        }
        if (scenario === 'connected-restart') {
          for (const [index, page] of pages.entries())
            await expect
              .poll(
                async () =>
                  (await page.evaluate(() => window.callRecoveryTest.inspect()))
                    .stats[index === 0 ? 'bob' : 'alice'].bytesReceived ?? 0,
              )
              .toBeGreaterThan(1000);
        }
        if (['simultaneous-restart', 'connected-restart'].includes(scenario)) {
          collideOffers = true;
          blockCandidates = false;
          await Promise.all(
            pages.map((page) =>
              page.evaluate(() => window.callRecoveryTest.restart()),
            ),
          );
        }
      }
      await expect
        .poll(
          async () =>
            (await pages[0].evaluate(() => window.callRecoveryTest.inspect()))
              .stats.bob.connectionState,
          { timeout: 30_000 },
        )
        .toBe('connected');
      await expect
        .poll(
          async () =>
            (await pages[1].evaluate(() => window.callRecoveryTest.inspect()))
              .stats.alice.connectionState,
          { timeout: 30_000 },
        )
        .toBe('connected');
      for (const [index, page] of pages.entries()) {
        const remote = index === 0 ? 'bob' : 'alice';
        const before = await page.evaluate(() =>
          window.callRecoveryTest.inspect(),
        );
        expect(Object.keys(before.stats)).toHaveLength(1);
        expect(before.audioElements).toBe(1);
        expect(before.stageOpens).toBe(0);
        await expect
          .poll(
            async () =>
              (await page.evaluate(() => window.callRecoveryTest.inspect()))
                .stats[remote].bytesReceived ?? 0,
            { timeout: 10_000 },
          )
          .toBeGreaterThan((before.stats[remote].bytesReceived ?? 0) + 1000);
        await expect(page.getByRole('status')).toHaveCount(0);
      }
      const downloadPromise = pages[0].waitForEvent('download');
      await pages[0]
        .getByRole('button', { name: 'Export diagnostics', exact: true })
        .click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
      const report = Buffer.concat(chunks).toString();
      if (scenario === 'exhausted-retry')
        expect(report).toContain('manual-retry');
      expect(report).not.toMatch(
        /alice|bob|Private|private-call|candidate|credential|sdp|192\.168|127\.0\.0/,
      );
      await pages[0]
        .getByRole('button', { name: 'Stop and clear', exact: true })
        .click();
      await expect(
        pages[0].getByRole('button', {
          name: 'Export diagnostics',
          exact: true,
        }),
      ).toHaveCount(0);
      expect(signalingErrors).toEqual([]);
      if (['simultaneous-restart', 'connected-restart'].includes(scenario))
        expect(
          collisionSignals
            .filter((signal) => signal.type === 'offer')
            .map((signal) => signal.index)
            .sort(),
        ).toEqual([0, 1]);
      for (const page of pages) {
        await page
          .getByRole('button', { name: 'Leave call', exact: true })
          .click();
        expect(
          (await page.evaluate(() => window.callRecoveryTest.inspect()))
            .audioElements,
        ).toBe(0);
      }
    } catch (error) {
      for (const page of pages)
        console.log(
          'MEDIA FAILURE',
          JSON.stringify(
            await page.evaluate(() => window.callRecoveryTest.inspect()),
          ),
        );
      throw error;
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
      await Promise.all(browsers.map((browser) => browser.close()));
    }
  });
