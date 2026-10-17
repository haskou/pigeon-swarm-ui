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
  const link = alice.locator('input[readonly]');

  await expect(link).toHaveValue(/\/invite\/community#c=.+&k=.+/, {
    timeout: SLOW,
  });
  const url = await link.inputValue();

  await alice.getByRole('button', { name: 'Close dialog' }).last().click();

  return url;
}

async function signInThrough(
  page: Page,
  url: string,
  password: string,
): Promise<void> {
  await page.goto(url);
  // A reload may keep the unlocked session; otherwise the login screen shows
  // the remembered identity. The invitation is kept in session storage
  // meanwhile, so it survives the sign-in.
  const remembered = page.getByTestId('auth-identity-preview');
  const join = page.getByRole('button', { name: 'Request to join' });

  await expect(remembered.or(join).first()).toBeVisible({ timeout: SLOW });
  if (await remembered.isVisible()) {
    await page.getByTestId('auth-password-input').fill(password);
    await page.getByTestId('auth-submit-button').click();
  }
  await join.click({ timeout: SLOW });
  await expect(page.getByText(/Waiting for a community manager/)).toBeVisible({
    timeout: SLOW,
  });
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
  await alice
    .getByRole('button', { name: /Add community/i })
    .first()
    .click();
  await alice
    .getByRole('button', { name: /^Create$/i })
    .first()
    .click();
  await alice.getByLabel('Community name').fill(communityName);
  await alice.getByRole('button', { name: /Private community/ }).click();
  await alice.getByRole('button', { name: 'Create community' }).click();
  await alice
    .getByRole('button', { name: ENCRYPTED })
    .waitFor({ timeout: SLOW });

  // Bob signs a claim from the link; Alice's client, as a manager, admits it
  // and adds him to the MLS group.
  const url = await createInviteLink(alice);

  await signInThrough(bob, url, password);
  await bob
    .getByRole('button', { name: communityName })
    .first()
    .click({ timeout: SLOW });
  await bob.getByRole('button', { name: ENCRYPTED }).waitFor({ timeout: SLOW });

  await sendMessage(alice, 'after the link join, from Alice');
  await bob
    .getByText('after the link join, from Alice', { exact: true })
    .waitFor({ timeout: SLOW });
});
