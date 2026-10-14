import { expect, test, type Page } from '@playwright/test';

import {
  conversationRow,
  loginIdentity,
  newIsolatedPage,
  openSidebar,
  pairNewDevice,
  registerIdentity,
  revokeOtherDevice,
  sendMessage,
  type TestIdentity,
} from './support/pigeonApp';

// Control letters (key package request and response, welcome) are polled
// every 15 s and group messages every 5 s, so an add takes several rounds.
const SLOW = 240_000;

async function addGroupParticipant(page: Page, handle: string): Promise<void> {
  const lookup = page.getByPlaceholder('@user or public ID');

  await lookup.fill(`@${handle}`);
  await expect(page.getByText(`@${handle}`, { exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole('button', { exact: true, name: 'Add' }).click();
  await expect(lookup).toHaveValue('');
}

async function createGroup(
  page: Page,
  name: string,
  handles: string[],
): Promise<void> {
  await openSidebar(page);
  await page
    .locator('[data-testid=create-conversation-button]:visible')
    .first()
    .click();
  await page.getByRole('button', { exact: true, name: 'Group' }).click();
  await page.getByPlaceholder('Mi grupo').fill(name);
  for (const handle of handles) {
    await addGroupParticipant(page, handle);
  }
  const submit = page.getByTestId('create-conversation-submit-button');

  await expect(submit).toBeEnabled({ timeout: 45_000 });
  await submit.click();
  await expect(submit).toBeHidden({ timeout: SLOW });
}

async function openGroup(page: Page, name: string): Promise<void> {
  await openSidebar(page);
  const row = conversationRow(page, name);

  await expect(row).toBeVisible({ timeout: SLOW });
  await row.click();
  await expect(page.getByTestId('message-composer-input')).toBeEnabled({
    timeout: SLOW,
  });
}

async function removeMember(
  page: Page,
  groupName: string,
  memberName: string,
): Promise<void> {
  await page
    .getByRole('button', { exact: true, name: groupName })
    .last()
    .click();
  const row = page
    .getByTestId('identity-member-row')
    .filter({ hasText: memberName });

  await expect(row).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await row
    .locator('xpath=..')
    .getByRole('button', { exact: true, name: 'Remove' })
    .click();
  await expect(row).toHaveCount(0, { timeout: 45_000 });
  await page.getByRole('button', { name: 'Close dialog' }).last().click();
}

/**
 * A member reads a group from the welcome that adds it, so nothing sent
 * before the adds land reaches it. Alice keeps sending numbered messages
 * until one reaches every other member; that one proves all are in.
 */
async function sendUntilEveryoneReads(
  sender: Page,
  readers: Page[],
  text: string,
): Promise<void> {
  let attempt = 0;

  await expect(async () => {
    attempt += 1;
    const message = `${text} #${attempt}`;

    await sendMessage(sender, message);
    for (const reader of readers) {
      await expect(reader.getByText(message, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
    }
  }).toPass({ intervals: [0], timeout: SLOW * 2 });
}

const DEVICE_CATALOG = /\/identity-devices\/[^/]+\/devices$/;

/** Every device credential the node listed to these pages, by identity. */
function recordDeviceCatalogs(pages: Page[]): Map<string, Set<string>> {
  const catalogs = new Map<string, Set<string>>();

  for (const page of pages) {
    page.on('response', async (response) => {
      if (!DEVICE_CATALOG.test(new URL(response.url()).pathname)) return;
      if (!response.ok()) return;
      const catalog = (await response.json().catch(() => undefined)) as
        | { credentials: string[]; identityId: string }
        | undefined;

      if (!catalog) return;
      const known = catalogs.get(catalog.identityId) ?? new Set<string>();

      for (const credential of catalog.credentials) known.add(credential);
      catalogs.set(catalog.identityId, known);
    });
  }

  return catalogs;
}

/**
 * Serves the page every device its identity ever listed, revoked ones too:
 * a revoked device still holds the identity key and can lie to itself.
 */
async function listEveryDeviceEverSeen(
  page: Page,
  catalogs: Map<string, Set<string>>,
): Promise<void> {
  await page.route(
    (url) => DEVICE_CATALOG.test(url.pathname),
    async (route) => {
      const [identityId, credentials] = [...catalogs.entries()][0] ?? [];

      if (!identityId || !credentials) return await route.fallback();
      await route.fulfill({
        json: { credentials: [...credentials], identityId },
      });
    },
  );
}

test('a member removed from a group conversation stops reading it', async ({
  browser,
}) => {
  test.setTimeout(900_000);
  const suffix = Date.now().toString(36);
  const password = `P455uruD3su!${suffix}`;
  const groupName = `Group ${suffix}`;
  const alice = await newIsolatedPage(browser);
  const bob = await newIsolatedPage(browser);
  const carol = await newIsolatedPage(browser);

  await registerIdentity(alice, {
    handle: `al${suffix}`,
    name: `Alice ${suffix}`,
    password,
  });
  await registerIdentity(bob, {
    handle: `bo${suffix}`,
    name: `Bob ${suffix}`,
    password,
  });
  await registerIdentity(carol, {
    handle: `ca${suffix}`,
    name: `Carol ${suffix}`,
    password,
  });

  await createGroup(alice, groupName, [`bo${suffix}`, `ca${suffix}`]);
  await openGroup(alice, groupName);
  await openGroup(bob, groupName);
  await openGroup(carol, groupName);

  await sendUntilEveryoneReads(alice, [bob, carol], 'hello from Alice');
  await sendMessage(bob, 'hello from Bob');
  for (const reader of [alice, carol]) {
    await expect(
      reader.getByText('hello from Bob', { exact: true }),
    ).toBeVisible({ timeout: SLOW });
  }

  await removeMember(alice, groupName, `Carol ${suffix}`);

  await sendMessage(alice, 'after removal');
  await expect(bob.getByText('after removal', { exact: true })).toBeVisible({
    timeout: SLOW,
  });

  // Carol stays on the page and keeps polling; the plaintext must never show.
  await carol.waitForTimeout(90_000);
  await expect(carol.getByText('after removal')).toHaveCount(0);
});

test('both devices of an identity read a group; a revoked one stops reading', async ({
  browser,
}) => {
  test.setTimeout(1_800_000);
  const suffix = Date.now().toString(36);
  const password = `P455uruD3su!${suffix}`;
  const groupName = `Group ${suffix}`;
  const bob: TestIdentity = {
    handle: `bo${suffix}`,
    name: `Bob ${suffix}`,
    password,
  };
  const alice = await newIsolatedPage(browser);
  const phone = await newIsolatedPage(browser);
  const laptop = await newIsolatedPage(browser);
  const tablet = await newIsolatedPage(browser);
  const reconciled: string[] = [];
  const catalogs = recordDeviceCatalogs([phone, laptop]);

  // The phone, holding Bob's first leaf, adds and removes his other leaves.
  phone.on('console', (message) => {
    const text = message.text();

    if (text.startsWith('Group devices reconciled:')) reconciled.push(text);
  });

  try {
    await registerIdentity(alice, {
      handle: `al${suffix}`,
      name: `Alice ${suffix}`,
      password,
    });
    await registerIdentity(phone, bob);
    await createGroup(alice, groupName, [bob.handle]);
    await openGroup(alice, groupName);
    await openGroup(phone, groupName);
    await sendUntilEveryoneReads(alice, [phone], 'hello from Alice');

    // The laptop paired after the group formed gets its own leaf from the
    // phone, with no re-invite.
    await pairNewDevice(phone, laptop, bob);
    await openGroup(laptop, groupName);
    await sendUntilEveryoneReads(alice, [phone, laptop], 'to both devices');
    expect(reconciled).toContain(
      'Group devices reconciled: removed 0, added 1.',
    );

    // The laptop's copy for the phone lands in the inbox both read; the
    // laptop shows its own message once all the same.
    await sendMessage(laptop, 'from the laptop');
    for (const reader of [alice, phone]) {
      await expect(
        reader.getByText('from the laptop', { exact: true }),
      ).toBeVisible({ timeout: SLOW });
    }
    await laptop.waitForTimeout(30_000);
    await expect(
      laptop.getByText('from the laptop', { exact: true }),
    ).toHaveCount(1);

    // The revoke rotates the device-sealed root; after signing in again the
    // phone reads its group inboxes with readers of the new root, and its
    // commit removes the laptop's leaf.
    await revokeOtherDevice(phone);
    await phone.getByRole('button', { name: 'Close dialog' }).last().click();
    await loginIdentity(phone, `@${bob.handle}`, password);
    await openGroup(phone, groupName);
    await expect
      .poll(() => reconciled, { timeout: SLOW })
      .toContain('Group devices reconciled: removed 1, added 0.');

    await sendMessage(alice, 'after the revoke');
    await expect(
      phone.getByText('after the revoke', { exact: true }),
    ).toBeVisible({ timeout: SLOW });

    // The revoked laptop keeps its old root and keeps polling until its own
    // removal check signs it out; the plaintext must never show.
    await laptop.waitForTimeout(60_000);
    await expect(laptop.getByText('after the revoke')).toHaveCount(0);

    await phone.reload();
    await loginIdentity(phone, `@${bob.handle}`, password);
    await openGroup(phone, groupName);
    await sendMessage(alice, 'after the reload');
    await expect(
      phone.getByText('after the reload', { exact: true }),
    ).toBeVisible({ timeout: SLOW });
    await expect(laptop.getByText('after the reload')).toHaveCount(0);

    // A tablet paired after the revoke gets its leaf in the real group from
    // the phone.
    await pairNewDevice(phone, tablet, bob);
    await openGroup(tablet, groupName);
    await sendUntilEveryoneReads(alice, [phone, tablet], 'to the tablet');

    // The revoked laptop makes a look-alike group with Alice and, believing
    // itself still listed, tries to pull the tablet in. The tablet replays
    // Bob's signed transitions, in which the laptop is revoked, so the
    // laptop can never welcome it and the laptop's messages never show.
    const lookAlike = `${groupName} again`;

    await listEveryDeviceEverSeen(laptop, catalogs);
    await createGroup(laptop, lookAlike, [`al${suffix}`]);
    await openGroup(laptop, lookAlike);
    for (let round = 1; round <= 4; round += 1) {
      await sendMessage(laptop, `look-alike #${round}`);
      await laptop.waitForTimeout(45_000);
    }
    await expect(tablet.getByText(/^look-alike #/)).toHaveCount(0);
    await expect(phone.getByText(/^look-alike #/)).toHaveCount(0);
  } finally {
    await alice.context().close();
    await phone.context().close();
    await laptop.context().close();
    await tablet.context().close();
  }
});
