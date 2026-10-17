import { expect, type Page } from '@playwright/test';

const SLOW = 240_000;

/** Creates an invite link for the open community and returns it. */
export async function createInviteLink(manager: Page): Promise<string> {
  await manager.getByRole('button', { name: 'Add member' }).click();
  await manager.getByRole('button', { name: 'Create invite link' }).click();
  const link = manager.locator('input[readonly]');

  await expect(link).toHaveValue(/\/invite\/community#c=.+&k=.+/, {
    timeout: SLOW,
  });
  const url = await link.inputValue();

  await manager.getByRole('button', { name: 'Close dialog' }).last().click();

  return url;
}

/**
 * Opens `url` and claims the invitation, signing in first when the reload
 * dropped the session. The manager's client admits the claim on its own.
 */
export async function claimInviteLink(
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
