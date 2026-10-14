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

/**
 * Add does nothing until the lookup shows its preview, and the handle may
 * already show elsewhere on the page, so Add is clicked until it takes.
 */
async function addGroupParticipant(page: Page, handle: string): Promise<void> {
  const lookup = page.getByPlaceholder('@user or public ID');

  await lookup.fill(`@${handle}`);
  await expect(async () => {
    await page
      .getByRole('button', { exact: true, name: 'Add' })
      .click({ timeout: 5_000 });
    await expect(lookup).toHaveValue('', { timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
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
    // the phone. The revoked laptop is signed out and wiped by its own
    // removal check by now; a welcome it sent before the revoke is refused
    // in the test below.
    await pairNewDevice(phone, tablet, bob);
    await openGroup(tablet, groupName);
    await sendUntilEveryoneReads(alice, [phone, tablet], 'to the tablet');
  } finally {
    await alice.context().close();
    await phone.context().close();
    await laptop.context().close();
    await tablet.context().close();
  }
});

/**
 * A revoked device's own client refuses to welcome its siblings (its gate
 * finds it outside the verified set) and wipes itself on its next removal
 * check, so the refusal a sibling makes is reached by a welcome sent before
 * the revoke and read after it. The phone answers the laptop's key package
 * request, then reads no control letters until the laptop is revoked.
 */
test('a welcome read after the device that sent it was revoked is refused', async ({
  browser,
}) => {
  test.setTimeout(1_800_000);
  const suffix = Date.now().toString(36);
  const password = `P455uruD3su!${suffix}`;
  const groupName = `Laptop group ${suffix}`;
  const bob: TestIdentity = {
    handle: `bo${suffix}`,
    name: `Bob ${suffix}`,
    password,
  };
  const alice = await newIsolatedPage(browser);
  const phone = await newIsolatedPage(browser);
  const laptop = await newIsolatedPage(browser);
  const reconciled: string[] = [];
  let rejected = 0;
  let answering = false;
  let holding = false;

  laptop.on('console', (message) => {
    const text = message.text();

    if (text.startsWith('Group devices reconciled:')) reconciled.push(text);
  });
  phone.on('console', (message) => {
    if (message.text() === 'Group mailbox control record rejected.') {
      rejected += 1;
    }
  });
  // Control letters to and from the phone travel through /notifications/:
  // its key package response is a POST, and after it every read comes back
  // empty while holding, so the laptop's welcome waits on the node.
  await phone.route(
    (url) => url.pathname.endsWith('/notifications/'),
    async (route) => {
      const method = route.request().method();

      if (answering && method === 'POST') holding = true;
      if (holding && method === 'GET') {
        await route.fulfill({ json: { results: [] } });

        return;
      }
      await route.fallback();
    },
  );

  try {
    await registerIdentity(alice, {
      handle: `al${suffix}`,
      name: `Alice ${suffix}`,
      password,
    });
    await registerIdentity(phone, bob);
    await pairNewDevice(phone, laptop, bob);

    // The laptop holds Bob's only leaf, so it asks the phone for a key
    // package and welcomes it.
    answering = true;
    await createGroup(laptop, groupName, [`al${suffix}`]);
    await openGroup(alice, groupName);
    await openGroup(laptop, groupName);
    await expect
      .poll(() => reconciled, { timeout: SLOW * 2 })
      .toContain('Group devices reconciled: removed 0, added 1.');
    expect(holding).toBe(true);
    expect(rejected).toBe(0);

    await revokeOtherDevice(phone);
    await phone.getByRole('button', { name: 'Close dialog' }).last().click();
    await loginIdentity(phone, `@${bob.handle}`, password);
    holding = false;
    answering = false;

    // The welcome is signed by a leaf the transitions no longer authorize.
    await expect.poll(() => rejected, { timeout: SLOW }).toBeGreaterThan(0);

    // Alice and the phone's own leaf stay in the epoch the welcome opened,
    // so anything Alice sends now the phone would read had it joined.
    await sendMessage(alice, 'after the refused welcome');
    await phone.waitForTimeout(60_000);
    const row = conversationRow(phone, groupName);

    if ((await row.count()) > 0) await row.first().click();
    await expect(phone.getByText('after the refused welcome')).toHaveCount(0);
  } finally {
    await alice.context().close();
    await phone.context().close();
    await laptop.context().close();
  }
});
