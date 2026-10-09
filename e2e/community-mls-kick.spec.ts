import { expect, test, type Page } from '@playwright/test';

import {
  newIsolatedPage,
  openSidebar,
  registerIdentity,
  sendMessage,
} from './support/pigeonApp';

const ENCRYPTED = /encryption is active/;
const SLOW = 240_000;

async function inviteAndJoin(
  alice: Page,
  bob: Page,
  handle: string,
  communityName: string,
): Promise<void> {
  await alice.getByRole('button', { name: 'Add member' }).click();
  await alice.getByPlaceholder('@user or public ID').fill(`@${handle}`);
  await alice.getByRole('button', { name: 'Add member' }).last().click();

  await openSidebar(bob);
  await bob
    .locator('[data-testid=notifications-open-button]:visible')
    .first()
    .click();
  await bob
    .getByTestId('notification-accept-button')
    .first()
    .waitFor({ timeout: SLOW });
  // The first card is the membership invitation; the second one is the
  // conversation-style notification.
  await bob.getByRole('button', { exact: true, name: 'Accept' }).first().click();
  await bob.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.status() === 200,
    { timeout: SLOW },
  );
  await bob.getByRole('button', { name: 'Close dialog' }).click();
  await bob.getByRole('button', { name: communityName }).click();
}

async function kickMember(alice: Page, name: string): Promise<void> {
  await alice.getByRole('button', { name: 'Manage community' }).click();
  await alice.getByRole('button', { exact: true, name: 'Members' }).click();
  await alice
    .getByRole('button', { name: new RegExp(`^B ${name}`) })
    .click({ force: true });
  await alice.getByRole('button', { exact: true, name: 'Kick' }).click();
  await alice.getByRole('button', { name: 'Confirm kick' }).click();
}

test('a member removed from a private community stops reading it', async ({
  browser,
}) => {
  test.setTimeout(900_000);
  const suffix = Date.now().toString(36);
  const password = `P455uruD3su!${suffix}`;
  const communityName = `Private ${suffix}`;
  const alice = await newIsolatedPage(browser);
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

  await inviteAndJoin(alice, bob, `bo${suffix}`, communityName);
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
