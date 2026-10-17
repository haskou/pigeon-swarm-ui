import { expect, test, type Page } from '@playwright/test';

import {
  claimInviteLink,
  createInviteLink,
} from './support/communityInvitations';
import {
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  sendMessage,
} from './support/pigeonApp';

const ENCRYPTED = /encryption is active/;
const SLOW = 240_000;

/**
 * Bob claims an invite link of Alice's; her client, as a manager, admits him
 * and adds him to the MLS group.
 */
async function inviteAndJoin(
  alice: Page,
  bob: Page,
  password: string,
  communityName: string,
): Promise<void> {
  const url = await createInviteLink(alice);

  await claimInviteLink(bob, url, password);
  await bob
    .getByRole('button', { name: communityName })
    .first()
    .click({ timeout: SLOW });
}

async function kickMember(alice: Page, name: string): Promise<void> {
  // The members aside lists the same member, without a status now that
  // community members show no presence; the row to kick is the dialog's.
  const member = alice
    .getByRole('button', { name: new RegExp(`^B ${name}`) })
    .and(alice.locator(':not([data-testid="identity-members-aside"] *)'));

  await alice.getByRole('button', { name: 'Manage community' }).click();
  await alice.getByRole('button', { exact: true, name: 'Members' }).click();
  await member.click({ force: true });
  await alice.getByRole('button', { exact: true, name: 'Kick' }).click();
  await alice.getByRole('button', { name: 'Confirm kick' }).click();
  // The row goes once the node removed the member, this device rotated the
  // group keys and the dialog reloaded the community. Sending before that
  // races the roster change, which briefly disables the composer.
  await expect(member).toHaveCount(0, { timeout: SLOW });
}

test('a member removed from a private community stops reading it', async ({
  browser,
}) => {
  test.setTimeout(900_000);
  const suffix = Date.now().toString(36);
  const password = `P455uruD3su!${suffix}`;
  const communityName = `Private ${suffix}`;
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

  await inviteAndJoin(alice, bob, password, communityName);
  await bob.getByRole('button', { name: ENCRYPTED }).waitFor({ timeout: SLOW });

  await sendMessage(alice, 'before the kick, from Alice');
  await bob
    .getByText('before the kick, from Alice', { exact: true })
    .waitFor({ timeout: SLOW });
  await sendMessage(bob, 'before the kick, from Bob');
  await alice
    .getByText('before the kick, from Bob', { exact: true })
    .waitFor({ timeout: SLOW });

  await kickMember(alice, `Bob ${suffix}`);
  await alice.getByRole('button', { name: 'Close dialog' }).last().click();

  await sendMessage(alice, 'after the kick, only for the remaining members');
  await expect(
    alice.getByText('after the kick, only for the remaining members', {
      exact: true,
    }),
  ).toBeVisible();

  // Bob stays on the page and keeps polling; the plaintext must never show.
  await bob.waitForTimeout(90_000);
  await expect(
    bob.getByText('after the kick, only for the remaining members'),
  ).toHaveCount(0);
});
