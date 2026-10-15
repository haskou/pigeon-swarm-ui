import {
  expect,
  test,
  type Locator,
  type Page,
  type Response,
} from '@playwright/test';

import {
  acceptLatestInvitation,
  conversationRow,
  createDirectConversation,
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  selectConversationByTitle,
  type TestIdentity,
} from './support/pigeonApp';

// The labels the presence dot carries, as the English copy names them.
const STATUSES = ['Online', 'Idle', 'Do not disturb', 'Offline', 'Invisible'];
// A contact reads its presence inbox every 30 s and re-evaluates every 5 s.
const RECEIVE = 60_000;
// An update lives 90 s from its receipt, read up to 30 s after it was sent,
// and expiry is noticed within 5 s.
const EXPIRY = 180_000;

test('a contact sees the shared status and sees an invisible contact as offline', async ({
  browser,
}, testInfo) => {
  test.setTimeout(480_000);

  const token = testRunToken(testInfo.project.name);
  const password = `P455uruD3su!${token}`;
  const alice: TestIdentity = {
    handle: `alice${token}`,
    name: `Alice ${token}`,
    password,
  };
  const bob: TestIdentity = {
    handle: `bob${token}`,
    name: `Bob ${token}`,
    password,
  };
  const alicePage = await newIsolatedPage(browser);
  const bobPage = await newIsolatedPage(browser);

  try {
    await registerIdentity(alicePage, alice);
    await registerIdentity(bobPage, bob);

    await createDirectConversation(alicePage, bob.handle);
    await acceptLatestInvitation(bobPage);

    await selectConversationByTitle(alicePage, bob.name);
    await selectConversationByTitle(bobPage, alice.name);

    const aliceOnBob = conversationRow(bobPage, alice.name);

    // Nothing is shown for a contact before sharing is turned on.
    expect(await contactStatuses(aliceOnBob)).toEqual([]);

    // Bob shares first and waits until his presence inbox is open. An update
    // written before the contact's inbox exists is dropped and the sender
    // pauses that contact for two minutes.
    const presenceInboxOpened = inboxOpening(bobPage);

    await shareStatus(bobPage);
    await presenceInboxOpened;
    await expect
      .poll(() => contactStatuses(aliceOnBob), { timeout: RECEIVE })
      .toEqual(['Offline']);

    await shareStatus(alicePage);
    await expect
      .poll(() => contactStatuses(aliceOnBob), { timeout: RECEIVE })
      .toEqual(['Online']);

    await selectOwnStatus(alicePage, 'Invisible');

    // Invisible sends nothing: Bob sees Alice's last update expire, and never
    // learns that she chose to be invisible.
    const seen = new Set<string>();

    await expect
      .poll(
        async () => {
          const statuses = await contactStatuses(aliceOnBob);

          statuses.forEach((status) => seen.add(status));

          return statuses;
        },
        { intervals: [2_000], timeout: EXPIRY },
      )
      .toEqual(['Offline']);
    expect([...seen].filter((status) => status !== 'Online')).toEqual([
      'Offline',
    ]);
  } finally {
    await alicePage.context().close();
    await bobPage.context().close();
  }
});

/** The presence labels shown on a conversation row. */
async function contactStatuses(row: Locator): Promise<string[]> {
  const titles = await row
    .locator('[title]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('title') ?? ''),
    );

  return titles.filter((title) => STATUSES.includes(title));
}

/**
 * Resolves once the page created an inbox and then read it, which a presence
 * inbox does as soon as sharing is turned on.
 */
function inboxOpening(page: Page): Promise<Response> {
  const created = new Set<string>();

  return page.waitForResponse(
    (response) => {
      const { pathname } = new URL(response.url());
      const method = response.request().method();
      const creation = /\/mailboxes\/([^/]+)$/.exec(pathname);
      const read = /\/mailboxes\/([^/]+)\/envelopes$/.exec(pathname);

      if (
        creation &&
        method === 'PUT' &&
        (response.ok() || response.status() === 409)
      ) {
        created.add(creation[1]);
      }

      return Boolean(
        read && method === 'GET' && response.ok() && created.has(read[1]),
      );
    },
    { timeout: 60_000 },
  );
}

async function shareStatus(page: Page): Promise<void> {
  const menu = page.getByRole('button', {
    exact: true,
    name: 'Open conversation menu',
  });

  await menu.click();
  await page.getByRole('button', { exact: true, name: 'Share status' }).click();

  // The choice is sealed on the device before the menu offers to stop it.
  await expect(async () => {
    await menu.click();
    await expect(
      page.getByRole('button', { exact: true, name: 'Stop sharing status' }),
    ).toBeVisible({ timeout: 2_000 });
    await page.keyboard.press('Escape');
  }).toPass({ timeout: 30_000 });
}

async function selectOwnStatus(page: Page, status: string): Promise<void> {
  await openSidebar(page);
  await page
    .locator('[data-testid="own-profile-menu-button"]:visible')
    .first()
    .click();
  await page.getByRole('button', { name: 'Select status' }).click();
  await page.getByRole('option', { exact: true, name: status }).click();
  await expect(
    page.getByRole('button', { name: 'Select status' }),
  ).toContainText(status);
  await expect(page.getByRole('button', { name: 'Select status' })).toBeEnabled(
    { timeout: 30_000 },
  );
}

function testRunToken(projectName: string): string {
  const projectPrefix = projectName.replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const timestamp = Date.now().toString(36).slice(-6);
  const random = Math.random().toString(36).slice(2, 6);

  return `${projectPrefix}${timestamp}${random}`.toLowerCase();
}
