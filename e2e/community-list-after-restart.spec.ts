import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

import {
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  waitForSettledLoginScreen,
} from './support/pigeonApp';

const execFileAsync = promisify(execFile);
const ENCRYPTED = /encryption is active/;
const EMPTY_LIST = /No communities yet/;
const SLOW = 240_000;
// The node needs up to this long after a restart before its replicated state
// is open; the list must appear within it, never settle on "no communities".
const RESTART_WINDOW_MS = 150_000;

test.describe('community list', () => {
  test('a new user gets the settled empty list with one read', async ({
    browser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'One engine is enough for the read count.',
    );
    const suffix = Date.now().toString(36);
    const page = await newIsolatedPage(browser);
    const reads: number[] = [];

    page.on('response', (response) => {
      const url = new URL(response.url());

      if (
        response.request().method() === 'GET' &&
        /^\/api\/communities\/?$/.test(url.pathname)
      ) {
        reads.push(response.status());
      }
    });

    try {
      await registerIdentity(page, {
        handle: `nu${suffix}`,
        name: `New ${suffix}`,
        password: `P455uruD3su!${suffix}`,
      });

      await expect
        .poll(() => reads.length, { timeout: 20_000 })
        .toBeGreaterThan(0);
      // A user this device never saw with a community has nothing to wait
      // for: a re-read loop would show here as further list reads.
      await page.waitForTimeout(12_000);

      expect(reads).toEqual([200]);
    } finally {
      await page.context().close();
    }
  });

  for (const scenario of [
    {
      // What the current node image answers while its state is still opening.
      answer: { body: JSON.stringify({ communities: [] }), status: 200 },
      name: 'an empty list',
      reads: 3,
    },
    {
      // What the node answers once it reports an unready state; more reads
      // than the shared 503020 retry budget covers.
      answer: { body: JSON.stringify({ code: 503020 }), status: 503 },
      name: 'a replicated state not ready',
      reads: 10,
    },
  ]) {
    test(`the creator sees the community again after the node restarts and first answers ${scenario.name}`, async ({
      browser,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        'The empty list is shown in the desktop layout.',
      );
      const container = process.env.E2E_NODE_CONTAINER;

      test.skip(
        !container,
        'Needs the node container the real node suite runs.',
      );
      test.setTimeout(900_000);
      const suffix = Date.now().toString(36);
      const handle = `rs${suffix}`;
      const password = `P455uruD3su!${suffix}`;
      const communityName = `Restart ${suffix}`;
      const page = await newIsolatedPage(browser);

      try {
        await registerIdentity(page, {
          handle,
          name: `Restart ${suffix}`,
          password,
        });
        await openSidebar(page);
        await page
          .getByRole('button', { name: /Add community/i })
          .first()
          .click();
        await page
          .getByRole('button', { name: /^Create$/i })
          .first()
          .click();
        await page.getByLabel('Community name').fill(communityName);
        await page.getByRole('button', { name: /Private community/ }).click();
        await page.getByRole('button', { name: 'Create community' }).click();
        await page
          .getByRole('button', { name: ENCRYPTED })
          .waitFor({ timeout: SLOW });

        await execFileAsync('docker', ['restart', String(container)]);
        const origin = new URL(String(testInfo.project.use.baseURL)).origin;

        await expect
          .poll(
            async () =>
              await fetch(`${origin}/api/node`).then(
                (response) => response.ok,
                () => false,
              ),
            { intervals: [2_000], timeout: 120_000 },
          )
          .toBe(true);

        // The node's first reads after the restart, as the node answers them
        // while its state opens; later reads reach the real node.
        let staleReads = scenario.reads;

        await page.route(/\/api\/communities\/?(\?.*)?$/, async (route) => {
          if (route.request().method() === 'GET' && staleReads > 0) {
            staleReads -= 1;
            await route.fulfill({
              body: scenario.answer.body,
              contentType: 'application/json',
              status: scenario.answer.status,
            });

            return;
          }

          await route.continue();
        });
        await page.goto('/');
        await waitForSettledLoginScreen(page);
        await page.getByTestId('auth-password-input').fill(password);
        await page.getByTestId('auth-submit-button').click();
        await page
          .getByRole('button', { name: /Add community/i })
          .first()
          .waitFor({ timeout: RESTART_WINDOW_MS });

        const community = page
          .getByRole('button', { name: communityName })
          .first();
        const deadline = Date.now() + RESTART_WINDOW_MS;

        for (;;) {
          // The empty-list notice may only show once the node settled an empty
          // list; this node holds a community, so it must never appear.
          await expect(page.getByText(EMPTY_LIST)).toHaveCount(0);

          if (await community.isVisible()) break;

          expect(
            Date.now(),
            'the community is not listed after the restart',
          ).toBeLessThan(deadline);
          await page.waitForTimeout(500);
        }

        expect(staleReads, 'the stale answers were all served').toBe(0);
      } finally {
        await page.context().close();
      }
    });
  }
});
