import { test } from '@playwright/test';

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

  await claimInviteLink(bob, url, password);
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
