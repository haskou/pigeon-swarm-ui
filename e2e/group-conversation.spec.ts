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

test('a group keeps reading across a revoke and reload, without the revoked device', async ({
  browser,
}) => {
  test.setTimeout(900_000);
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

  try {
    await registerIdentity(alice, {
      handle: `al${suffix}`,
      name: `Alice ${suffix}`,
      password,
    });
    await registerIdentity(phone, bob);
    await pairNewDevice(phone, laptop, bob);

    await createGroup(alice, groupName, [bob.handle]);
    await openGroup(alice, groupName);
    await openGroup(phone, groupName);
    await sendUntilEveryoneReads(alice, [phone], 'hello from Alice');

    // The revoke rotates the device-sealed root; the reload then opens the
    // group under the new root alone, with no replaced root in the session.
    await revokeOtherDevice(phone);
    await phone.getByRole('button', { name: 'Close dialog' }).last().click();
    await loginIdentity(phone, `@${bob.handle}`, password);
    await openGroup(phone, groupName);

    await sendMessage(alice, 'after the revoke');
    await expect(
      phone.getByText('after the revoke', { exact: true }),
    ).toBeVisible({ timeout: SLOW });

    // The revoked laptop keeps its old root and keeps polling; the plaintext
    // must never show.
    await laptop.waitForTimeout(60_000);
    await expect(laptop.getByText('after the revoke')).toHaveCount(0);
  } finally {
    await alice.context().close();
    await phone.context().close();
    await laptop.context().close();
  }
});
