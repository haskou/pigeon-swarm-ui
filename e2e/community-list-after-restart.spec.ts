import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { expect, test } from '@playwright/test';

import {
  loginIdentity,
  newIsolatedPage,
  openSidebar,
  registerIdentity,
} from './support/pigeonApp';

const execFileAsync = promisify(execFile);
const ENCRYPTED = /encryption is active/;
const EMPTY_LIST = /No communities yet/;
const SLOW = 240_000;
// The node needs up to this long after a restart before its replicated state
// is open; the list must appear within it, never settle on "no communities".
const RESTART_WINDOW_MS = 150_000;

test.describe('community list', () => {
  test('a new user sees the empty list at once', async ({
    browser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'The empty list is shown in the desktop layout.',
    );
    const suffix = Date.now().toString(36);
    const page = await newIsolatedPage(browser);

    try {
      await registerIdentity(page, {
        handle: `nu${suffix}`,
        name: `New ${suffix}`,
        password: `P455uruD3su!${suffix}`,
      });

      await expect(page.getByText(EMPTY_LIST)).toBeVisible({ timeout: 20_000 });
    } finally {
      await page.context().close();
    }
  });

  test('the creator sees the community again after the node restarts, never an empty list', async ({
    browser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'The empty list is shown in the desktop layout.',
    );
    const container = process.env.E2E_NODE_CONTAINER;

    test.skip(!container, 'Needs the node container the real node suite runs.');
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

      await loginIdentity(page, handle, password);

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
    } finally {
      await page.context().close();
    }
  });
});
