import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

type AuditMetric = {
  horizontalOverflow: number;
  smallControls: Array<{
    height: number;
    label: string;
    width: number;
  }>;
  state: string;
  viewport: {
    height: number;
    width: number;
  };
};

const outputRoot = path.resolve(
  process.cwd(),
  process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'visual-audit',
);
const identity = process.env.VISUAL_AUDIT_USER?.trim();
const password = process.env.VISUAL_AUDIT_PASSWORD ?? '';
const recoveryKey = process.env.VISUAL_AUDIT_RECOVERY_KEY?.trim();
const language = process.env.VISUAL_AUDIT_LANGUAGE === 'en' ? 'en' : 'es';

test.describe('visual audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((selectedLanguage) => {
      window.localStorage.setItem('pigeon-swarm-language-v2', selectedLanguage);
      window.localStorage.setItem('pigeon-swarm-language-explicit-v3', 'true');
      window.localStorage.removeItem('pigeon-swarm-credentials');
    }, language);
  });

  test('captures representative application states', async ({
    page,
  }, testInfo) => {
    test.slow();

    const projectOutput = path.join(outputRoot, testInfo.project.name);
    const metrics: AuditMetric[] = [];

    rmSync(projectOutput, { force: true, recursive: true });
    mkdirSync(projectOutput, { recursive: true });
    await page.goto('/');
    await capture(page, projectOutput, metrics, '01-login');

    if (!identity || !password) {
      testInfo.annotations.push({
        description:
          'Set VISUAL_AUDIT_USER and VISUAL_AUDIT_PASSWORD to capture authenticated states.',
        type: 'authenticated-states-skipped',
      });
      writeMetrics(projectOutput, metrics);

      return;
    }

    await page.getByTestId('auth-identity-input').fill(identity);
    await page.getByTestId('auth-password-input').fill(password);

    if (recoveryKey) {
      await page.getByTestId('auth-use-recovery-key-toggle').click();
      await page.getByTestId('auth-recovery-key-input').fill(recoveryKey);
    }

    await page.getByTestId('auth-submit-button').click();
    await waitForWorkspace(page);
    await dismissPushPrompt(page);
    await capture(page, projectOutput, metrics, '02-workspace');

    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', {
            name: /Abrir menu de conversacion|Open conversation menu/i,
          }),
        ),
      metrics,
      name: '03-header-menu',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    if (isCompactViewport(page)) {
      await openSidebar(page);
      await capture(page, projectOutput, metrics, '04-sidebar');
    }

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(page.getByTestId('create-conversation-button')),
      metrics,
      name: '05-create-conversation',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(page.getByTestId('notifications-open-button')),
      metrics,
      name: '06-notifications',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(page.getByTestId('own-profile-menu-button')),
      metrics,
      name: '07-profile-menu',
      outputDirectory: projectOutput,
      page,
    });

    await captureOptionalState({
      action: () => clickFirstVisible(page.getByTestId('edit-profile-button')),
      metrics,
      name: '08-profile-editor',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', {
            name: /Ajustes del nodo|Node settings/i,
          }),
        ),
      metrics,
      name: '09-node-settings',
      outputDirectory: projectOutput,
      page,
    });

    await closeOverlay(page);
    await openSidebar(page);
    await captureOptionalState({
      action: () => clickFirstVisible(firstCommunityButton(page)),
      metrics,
      name: '10-community-workspace',
      outputDirectory: projectOutput,
      page,
    });

    await openSidebar(page);
    await capture(page, projectOutput, metrics, '11-community-navigation');

    await captureOptionalState({
      action: () => clickFirstVisible(firstTextChannelButton(page)),
      metrics,
      name: '12-community-channel',
      outputDirectory: projectOutput,
      page,
    });

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', {
            name: /Gestionar comunidad|Manage community/i,
          }),
        ),
      metrics,
      name: '13-community-management',
      outputDirectory: projectOutput,
      page,
    });

    writeMetrics(projectOutput, metrics);
  });
});

async function capture(
  page: Page,
  outputDirectory: string,
  metrics: AuditMetric[],
  name: string,
): Promise<void> {
  await page.evaluate(async () => document.fonts.ready);
  await page.waitForTimeout(350);
  metrics.push(await collectMetrics(page, name));
  await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    path: path.join(outputDirectory, `${name}.png`),
  });
}

async function captureOptionalState({
  action,
  metrics,
  name,
  outputDirectory,
  page,
}: {
  action: () => Promise<void>;
  metrics: AuditMetric[];
  name: string;
  outputDirectory: string;
  page: Page;
}): Promise<void> {
  try {
    await action();
    await capture(page, outputDirectory, metrics, name);
  } catch (caught) {
    test.info().annotations.push({
      description: caught instanceof Error ? caught.message : String(caught),
      type: `${name}-skipped`,
    });
  }
}

async function collectMetrics(page: Page, state: string): Promise<AuditMetric> {
  return page.evaluate((currentState) => {
    const viewport = {
      height: window.innerHeight,
      width: window.innerWidth,
    };
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [role="button"]',
      ),
    );
    const smallControls = controls
      .filter((control) => {
        const style = window.getComputedStyle(control);
        const bounds = control.getBoundingClientRect();

        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          bounds.width > 0 &&
          bounds.height > 0 &&
          (bounds.width < 40 || bounds.height < 40)
        );
      })
      .slice(0, 40)
      .map((control) => {
        const bounds = control.getBoundingClientRect();
        const label =
          control.getAttribute('aria-label') ??
          control.getAttribute('title') ??
          control.textContent?.trim() ??
          control.tagName.toLowerCase();

        return {
          height: Math.round(bounds.height),
          label: label.slice(0, 80),
          width: Math.round(bounds.width),
        };
      });

    return {
      horizontalOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth,
      ),
      smallControls,
      state: currentState,
      viewport,
    };
  }, state);
}

async function closeOverlay(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

async function dismissPushPrompt(page: Page): Promise<void> {
  const prompt = page.getByTestId('push-notification-prompt');

  if (!(await prompt.isVisible().catch(() => false))) return;

  await page.getByTestId('push-notification-dismiss-button').click();
  await expect(prompt).toBeHidden({ timeout: 10_000 });
}

async function openSidebar(page: Page): Promise<void> {
  if (await isNavigationPanelVisible(page)) {
    return;
  }

  const opener = page.getByTestId('workspace-sidebar-open-button');

  if (await isVisibleInViewport(opener)) {
    await clickFirstVisible(opener);
  }

  await expect
    .poll(() => isNavigationPanelVisible(page), { timeout: 15_000 })
    .toBe(true);
}

async function waitForWorkspace(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        (await isVisibleInViewport(
          page.getByTestId('create-conversation-button'),
        )) ||
        (await isVisibleInViewport(
          page.getByTestId('workspace-sidebar-open-button'),
        )),
      { timeout: 90_000 },
    )
    .toBe(true);
}

async function clickFirstVisible(locator: Locator): Promise<void> {
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    const target = locator.nth(index);

    if (!(await isVisibleInViewport(target))) continue;

    await target.click({ timeout: 5_000 });

    return;
  }

  throw new Error('No visible matching control was found.');
}

function firstCommunityButton(page: Page): Locator {
  return page.locator('aside button[title]:not([aria-busy])').filter({
    hasNotText: /Añadir comunidad|Add community|Instalar|Install/i,
  });
}

function firstTextChannelButton(page: Page): Locator {
  return page.locator('button').filter({ hasText: /^#\s+/ });
}

async function isNavigationPanelVisible(page: Page): Promise<boolean> {
  return (
    (await isVisibleInViewport(
      page.getByTestId('create-conversation-button'),
    )) ||
    (await isVisibleInViewport(firstTextChannelButton(page))) ||
    (await isVisibleInViewport(
      page.getByRole('button', {
        name: /Gestionar comunidad|Manage community/i,
      }),
    ))
  );
}

function isCompactViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 1024;
}

async function isVisibleInViewport(locator: Locator): Promise<boolean> {
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    const target = locator.nth(index);

    if (!(await target.isVisible().catch(() => false))) continue;

    const visibleInViewport = await target
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect();

        return (
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.bottom > 0 &&
          bounds.right > 0 &&
          bounds.top < window.innerHeight &&
          bounds.left < window.innerWidth
        );
      })
      .catch(() => false);

    if (visibleInViewport) return true;
  }

  return false;
}

function writeMetrics(outputDirectory: string, metrics: AuditMetric[]): void {
  writeFileSync(
    path.join(outputDirectory, 'metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
}
