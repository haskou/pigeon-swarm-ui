import { expect, test, type Page } from '@playwright/test';

import {
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  sendMessage,
} from './support/pigeonApp';

const ENCRYPTED = /encryption is active/;
const SLOW = 240_000;

async function createInviteLink(alice: Page): Promise<string> {
  await alice.getByRole('button', { name: 'Add member' }).click();
  await alice.getByRole('button', { name: 'Create invite link' }).click();
  await alice.getByRole('button', { name: 'Invite by link' }).click();
  const link = alice.locator('input[readonly]');

  await expect(link).toHaveValue(/\/invite\/community\//, { timeout: SLOW });
  const url = await link.inputValue();

  await alice.getByRole('button', { name: 'Close dialog' }).last().click();

  return url;
}

async function signInThrough(
  page: Page,
  url: string,
  password: string,
  communityName: string,
): Promise<void> {
  await page.goto(url);
  // A reload may keep the unlocked session; otherwise the login screen shows
  // the remembered identity. Accepting the link switches to the community it
  // opened, so the messages workspace only shows for a moment and is no sign
  // of a finished sign-in.
  const remembered = page.getByTestId('auth-identity-preview');
  const community = page.getByRole('button', { name: communityName }).first();

  await expect(remembered.or(community).first()).toBeVisible({
    timeout: SLOW,
  });
  if (await remembered.isVisible()) {
    await page.getByTestId('auth-password-input').fill(password);
    await page.getByTestId('auth-submit-button').click();
  }
  await community.click({ timeout: SLOW });
}

test('a member joins a private community through an invite link', async ({
  browser,
}) => {
  test.setTimeout(900_000);
  const suffix = Date.now().toString(36);
  const password = `P455uruD3su!${suffix}`;
  const communityName = `Linked ${suffix}`;
  const alice = await newIsolatedPage(browser, {
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const bob = await newIsolatedPage(browser);

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

  await openSidebar(alice);
  await alice.getByRole('button', { name: /Add community/i }).first().click();
  await alice.getByRole('button', { name: /^Create$/i }).first().click();
  await alice.getByLabel('Community name').fill(communityName);
  await alice.getByRole('button', { name: /Private community/ }).click();
  await alice.getByRole('button', { name: 'Create community' }).click();
  await alice.getByRole('button', { name: ENCRYPTED }).waitFor({ timeout: SLOW });

  // The node refuses a link whose token does not commit to its limits, so a
  // created link that opens the community proves both ends agree on it.
  const url = await createInviteLink(alice);

  await signInThrough(bob, url, password, communityName);
  await bob.getByRole('button', { name: ENCRYPTED }).waitFor({ timeout: SLOW });

  await sendMessage(alice, 'after the link join, from Alice');
  await bob
    .getByText('after the link join, from Alice', { exact: true })
    .waitFor({ timeout: SLOW });
});
