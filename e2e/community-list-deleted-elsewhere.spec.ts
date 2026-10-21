import { expect, type Page, test } from '@playwright/test';

import {
  claimInviteLink,
  createInviteLink,
} from './support/communityInvitations';
import {
  loginIdentity,
  newIsolatedPage,
  openSidebar,
  registerIdentity,
} from './support/pigeonApp';

const ENCRYPTED = /encryption is active/;
const EMPTY_LIST = /No communities yet/;
const NOT_SETTLED =
  /This device listed communities for you, but the node still lists none/;
const SLOW = 240_000;
// The list is read again for up to 60 s before an empty answer is reported
// for a device that listed communities, plus the last read.
const SETTLE_WINDOW_MS = 120_000;

// Opens the app again. A reload may keep the unlocked session, which reads the
// community list on its own; otherwise the login screen shows the remembered
// identity and the password signs in.
async function reopen(page: Page, password: string): Promise<void> {
  await page.goto('/');
  const remembered = page.getByTestId('auth-identity-preview');
  const workspace = page
    .getByRole('button', { name: /Add community/i })
    .first();

  await expect(remembered.or(workspace).first()).toBeVisible({
    timeout: SLOW,
  });
  if (await remembered.isVisible()) {
    await page.getByTestId('auth-password-input').fill(password);
    await page.getByTestId('auth-submit-button').click();
  }
}

test('a device whose communities were all left on another device continues without them', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The empty list is shown in the desktop layout.',
  );
  test.setTimeout(900_000);
  const suffix = Date.now().toString(36);
  const password = `P455uruD3su!${suffix}`;
  const communityName = `Left ${suffix}`;
  const memberHandle = `lm${suffix}`;
  const owner = await newIsolatedPage(browser, {
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const laptop = await newIsolatedPage(browser);
  const phone = await newIsolatedPage(browser);

  try {
    await registerIdentity(owner, {
      handle: `lo${suffix}`,
      name: `Owner ${suffix}`,
      password,
    });
    const recoveryKey = await registerIdentity(laptop, {
      handle: memberHandle,
      name: `Member ${suffix}`,
      password,
    });

    await openSidebar(owner);
    await owner
      .getByRole('button', { name: /Add community/i })
      .first()
      .click();
    await owner
      .getByRole('button', { name: /^Create$/i })
      .first()
      .click();
    await owner.getByLabel('Community name').fill(communityName);
    await owner.getByRole('button', { name: /Private community/ }).click();
    await owner.getByRole('button', { name: 'Create community' }).click();
    await owner
      .getByRole('button', { name: ENCRYPTED })
      .waitFor({ timeout: SLOW });

    // The laptop lists the community, so it remembers that this identity has
    // communities.
    await claimInviteLink(laptop, await createInviteLink(owner), password);
    await laptop
      .getByRole('button', { name: communityName })
      .first()
      .waitFor({ timeout: SLOW });

    // The phone, the same identity on another device, leaves the community.
    await loginIdentity(phone, `@${memberHandle}`, password, recoveryKey);
    const phoneCommunity = phone
      .getByRole('button', { name: communityName })
      .first();

    await phoneCommunity.waitFor({ timeout: SLOW });
    phone.once('dialog', (dialog) => void dialog.accept());
    await phoneCommunity.click({ button: 'right' });
    await phone
      .getByRole('button', { name: 'Leave community', exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await expect(phoneCommunity).toHaveCount(0, { timeout: SLOW });

    // The node settles an empty list for the laptop, which the laptop cannot
    // tell from a node still opening its state: it reports the list as not
    // settled, never as empty, and offers to continue without communities.
    await reopen(laptop, password);
    await laptop
      .getByText(NOT_SETTLED)
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: SETTLE_WINDOW_MS });
    await expect(laptop.getByText(EMPTY_LIST)).toHaveCount(0);

    await laptop
      .getByRole('button', { name: 'Continue without communities' })
      .filter({ visible: true })
      .first()
      .click();
    await laptop
      .getByText(EMPTY_LIST)
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 30_000 });
    await expect(laptop.getByText(NOT_SETTLED)).toHaveCount(0);

    // The choice holds: the next sign-in settles the empty list at once.
    await reopen(laptop, password);
    await laptop
      .getByText(EMPTY_LIST)
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 30_000 });
    await expect(laptop.getByText(NOT_SETTLED)).toHaveCount(0);
  } finally {
    await Promise.all(
      [owner, laptop, phone].map(async (page) => await page.context().close()),
    );
  }
});
