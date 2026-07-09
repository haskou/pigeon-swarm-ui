import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
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

type AuditManifest = {
  capturedStates: string[];
  skippedStates: Array<{
    reason: string;
    state: string;
  }>;
};

const outputRoot = path.resolve(
  process.cwd(),
  process.env.VISUAL_AUDIT_OUTPUT_DIR ?? 'visual-audit',
);
const identity = process.env.VISUAL_AUDIT_USER?.trim();
const password = process.env.VISUAL_AUDIT_PASSWORD ?? '';
const recoveryKey = process.env.VISUAL_AUDIT_RECOVERY_KEY?.trim();
const memberIdentity =
  process.env.VISUAL_AUDIT_MEMBER_IDENTITY?.trim() ??
  process.env.VISUAL_AUDIT_CALL_USER_A?.trim();
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
      writeAuditReport(projectOutput, metrics, testInfo.annotations);

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
      action: () => attachAuditFiles(page, 1),
      metrics,
      name: '02a-composer-single-attachment',
      outputDirectory: projectOutput,
      page,
    });
    await captureOptionalState({
      action: () => attachAuditFiles(page, 2),
      metrics,
      name: '02b-composer-multiple-attachments',
      outputDirectory: projectOutput,
      page,
    });
    await clearAuditAttachments(page);

    await captureOptionalState({
      action: () => openEncryptionDetails(page),
      metrics,
      name: '03-conversation-encryption',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await captureOptionalState({
      action: () => openHeaderMenu(page),
      metrics,
      name: '04-header-menu',
      outputDirectory: projectOutput,
      page,
    });
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', {
            name: /Ajustes de notificaciones|Notification settings/i,
          }),
        ),
      metrics,
      name: '05-notification-settings',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openHeaderMenu(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', { name: /Ver datos|View data/i }),
        ),
      metrics,
      name: '06-conversation-data',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    if (isMobileViewport(page)) {
      await openHeaderMenu(page);
      await captureOptionalState({
        action: () =>
          clickFirstVisible(
            page.getByRole('button', { name: /Ver eventos|View events/i }),
          ),
        metrics,
        name: '07-realtime-events',
        outputDirectory: projectOutput,
        page,
      });
      await closeOverlay(page);
    }

    await captureOptionalState({
      action: () => openStickerPicker(page),
      metrics,
      name: '08-sticker-picker',
      outputDirectory: projectOutput,
      page,
    });
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', { name: /Gestionar|Manage/i }),
        ),
      metrics,
      name: '09-sticker-manager',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /Packs guardados|Saved packs/i,
      metrics,
      name: '09a-sticker-manager-saved',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /Crear pack|Create pack/i,
      metrics,
      name: '09b-sticker-manager-create',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);
    await closeStickerPicker(page);

    if (isCompactViewport(page)) {
      await openSidebar(page);
      await capture(page, projectOutput, metrics, '10-sidebar');
    }

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(page.getByTestId('create-conversation-button')),
      metrics,
      name: '11-create-conversation',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /^Grupo$|^Group$/i,
      metrics,
      name: '11a-create-group-conversation',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', {
            name: /Añadir comunidad|Add community/i,
          }),
        ),
      metrics,
      name: '12-community-discovery',
      outputDirectory: projectOutput,
      page,
    });
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', { name: /^Crear$|^Create$/i }),
        ),
      metrics,
      name: '13-create-community',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(page.getByTestId('notifications-open-button')),
      metrics,
      name: '14-notifications',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(page.getByTestId('own-profile-menu-button')),
      metrics,
      name: '15-profile-menu',
      outputDirectory: projectOutput,
      page,
    });

    await captureOptionalState({
      action: () => clickFirstVisible(page.getByTestId('edit-profile-button')),
      metrics,
      name: '16-profile-editor',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /^Redes$|^Networks$/i,
      metrics,
      name: '16a-profile-networks',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /Seguridad|Security/i,
      metrics,
      name: '16b-profile-security',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /Llavero|Keychain/i,
      metrics,
      name: '16c-profile-keychain',
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
      name: '17-node-settings',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /^Redes(?:\s*\(\d+\))?$|^Networks(?:\s*\(\d+\))?$/i,
      metrics,
      name: '17a-node-networks',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /Configuraci[oó]n|Configuration/i,
      metrics,
      name: '17b-node-configuration',
      outputDirectory: projectOutput,
      page,
    });
    await captureDialogSection({
      label: /Pares(?:\s*\(\d+\))?|Peers(?:\s*\(\d+\))?/i,
      metrics,
      name: '17c-node-peers',
      outputDirectory: projectOutput,
      page,
    });

    await closeOverlay(page);
    await openSidebar(page);
    await captureOptionalState({
      action: () => clickFirstVisible(firstCommunityButton(page)),
      metrics,
      name: '18-community-workspace',
      outputDirectory: projectOutput,
      page,
    });

    await openSidebar(page);
    await capture(page, projectOutput, metrics, '19-community-navigation');

    await captureOptionalState({
      action: () => clickFirstVisible(firstTextChannelButton(page)),
      metrics,
      name: '20-community-channel',
      outputDirectory: projectOutput,
      page,
    });

    await captureOptionalState({
      action: () => openEncryptionDetails(page),
      metrics,
      name: '21-community-encryption',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openHeaderMenu(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', { name: /Ver datos|View data/i }),
        ),
      metrics,
      name: '22-community-data',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openHeaderMenu(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', {
            name: /Ajustes de notificaciones|Notification settings/i,
          }),
        ),
      metrics,
      name: '23-community-notification-settings',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await captureOptionalState({
      action: async () => {
        if (isCompactViewport(page)) await openHeaderMenu(page);

        await clickFirstVisible(
          page.getByRole('button', { name: /Añadir miembro|Add member/i }),
        );
      },
      metrics,
      name: '24-add-community-member',
      outputDirectory: projectOutput,
      page,
    });
    if (memberIdentity) {
      await captureOptionalState({
        action: async () => {
          await page
            .getByPlaceholder(/@usuario o ID p[uú]blica|@user or public ID/i)
            .fill(memberIdentity);
          await expect(
            page
              .locator('section.ui-dialog-surface')
              .getByTestId('identity-member-row'),
          ).toBeVisible({ timeout: 15_000 });
        },
        metrics,
        name: '24a-add-community-member-preview',
        outputDirectory: projectOutput,
        page,
      });
    }
    await captureDialogSection({
      label: /Crear enlace de invitaci[oó]n|Create invite link/i,
      metrics,
      name: '24b-add-community-invite-link',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', { name: /Crear encuesta|Create poll/i }),
        ),
      metrics,
      name: '25-create-poll',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await openSidebar(page);
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', {
            name: /Gestionar comunidad|Manage community/i,
          }),
        ),
      metrics,
      name: '26-community-management',
      outputDirectory: projectOutput,
      page,
    });
    await captureCommunityManagementSection({
      label: /Canales|Channels/i,
      metrics,
      name: '26a-community-management-channels',
      outputDirectory: projectOutput,
      page,
    });
    await captureCommunityManagementSection({
      label: /^Roles$/i,
      metrics,
      name: '26b-community-management-roles',
      outputDirectory: projectOutput,
      page,
    });
    await captureCommunityManagementSection({
      label: /Miembros|Members/i,
      metrics,
      name: '26c-community-management-members',
      outputDirectory: projectOutput,
      page,
    });
    await captureOptionalState({
      action: async () => {
        const expandMember = page
          .locator('section.ui-dialog-surface button[aria-expanded="false"]')
          .first();

        await expandMember.scrollIntoViewIfNeeded({ timeout: 5_000 });
        await expandMember.click({ timeout: 5_000 });
      },
      metrics,
      name: '26c1-community-management-member-expanded',
      outputDirectory: projectOutput,
      page,
    });
    await captureCommunityManagementSection({
      label: /Baneados|Banned/i,
      metrics,
      name: '26d-community-management-banned',
      outputDirectory: projectOutput,
      page,
    });
    await captureCommunityManagementSection({
      label: /Invitaciones|Invitations/i,
      metrics,
      name: '26e-community-management-invitations',
      outputDirectory: projectOutput,
      page,
    });
    await captureCommunityManagementSection({
      label: /Auditor[ií]a|Audit|Registro de moderaci[oó]n|Moderation log/i,
      metrics,
      name: '26f-community-management-audit',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);

    await captureOptionalState({
      action: () => joinFirstVoiceChannel(page),
      metrics,
      name: '27-call-compact',
      outputDirectory: projectOutput,
      page,
    });
    await captureOptionalState({
      action: async () => {
        const compactCallBar = page.getByTestId('compact-call-bar');

        await compactCallBar.press('Enter');
        await expect(page.getByTestId('call-stage-dialog')).toBeVisible({
          timeout: 10_000,
        });
      },
      metrics,
      name: '28-call-stage',
      outputDirectory: projectOutput,
      page,
    });
    await captureOptionalState({
      action: () =>
        clickFirstVisible(
          page.getByRole('button', { name: /Ver datos|View data/i }),
        ),
      metrics,
      name: '28a-call-technical-data',
      outputDirectory: projectOutput,
      page,
    });
    await closeOverlay(page);
    await leaveCall(page);

    writeAuditReport(projectOutput, metrics, testInfo.annotations);
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
    scale: 'css',
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

async function openHeaderMenu(page: Page): Promise<void> {
  await clickFirstVisible(
    page.getByRole('button', {
      name: /Abrir men[uú] de (conversaci[oó]n|comunidad)|Open (conversation|community) menu/i,
    }),
  );
}

async function captureCommunityManagementSection({
  label,
  metrics,
  name,
  outputDirectory,
  page,
}: {
  label: RegExp;
  metrics: AuditMetric[];
  name: string;
  outputDirectory: string;
  page: Page;
}): Promise<void> {
  await captureOptionalState({
    action: async () => {
      const navigationItem = page.getByRole('button', { name: label }).first();

      await navigationItem.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await navigationItem.click({ timeout: 5_000 });
    },
    metrics,
    name,
    outputDirectory,
    page,
  });
}

async function captureDialogSection({
  label,
  metrics,
  name,
  outputDirectory,
  page,
}: {
  label: RegExp;
  metrics: AuditMetric[];
  name: string;
  outputDirectory: string;
  page: Page;
}): Promise<void> {
  await captureOptionalState({
    action: async () => {
      const item = page.getByRole('button', { name: label }).first();

      await item.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await item.click({ timeout: 5_000 });
    },
    metrics,
    name,
    outputDirectory,
    page,
  });
}

async function attachAuditFiles(page: Page, batch: 1 | 2): Promise<void> {
  const files =
    batch === 1
      ? [
          {
            buffer: Buffer.from(
              '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#223047"/><circle cx="320" cy="210" r="110" fill="#67d9e8"/><text x="320" y="390" text-anchor="middle" fill="white" font-size="42">Pigeon</text></svg>',
            ),
            mimeType: 'image/svg+xml',
            name: 'pigeon-preview.svg',
          },
        ]
      : [
          {
            buffer: Buffer.from(
              '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#362440"/><path d="M100 380 300 100l240 280z" fill="#db72e8"/></svg>',
            ),
            mimeType: 'image/svg+xml',
            name: 'community-banner.svg',
          },
          {
            buffer: Buffer.from('Visual audit attachment'),
            mimeType: 'text/plain',
            name: 'release-notes.txt',
          },
        ];

  await page.getByTestId('composer-file-input').setInputFiles(files);
  await expect(
    page.getByText(/Adjuntos seleccionados|Selected attachments/i),
  ).toBeVisible();
}

async function clearAuditAttachments(page: Page): Promise<void> {
  const removeButtons = page.getByRole('button', {
    name: /Quitar adjunto|Remove attachment/i,
  });

  while ((await removeButtons.count()) > 0) {
    await removeButtons.first().click();
  }
}

async function openEncryptionDetails(page: Page): Promise<void> {
  await clickFirstVisible(
    page.getByRole('button', {
      name: /cifrado|encryption|texto plano|plaintext/i,
    }),
  );
}

async function openStickerPicker(page: Page): Promise<void> {
  await clickFirstVisible(
    page.getByRole('button', { name: /Abrir stickers|Open stickers/i }),
  );
}

async function closeStickerPicker(page: Page): Promise<void> {
  const pickerButton = page.getByRole('button', {
    name: /Abrir stickers|Open stickers/i,
  });

  if (await isVisibleInViewport(pickerButton)) {
    await clickFirstVisible(pickerButton);
  }
}

async function joinFirstVoiceChannel(page: Page): Promise<void> {
  await openSidebar(page);
  await clickFirstVisible(firstVoiceChannelButton(page));
  await expect(page.getByTestId('compact-call-bar')).toBeVisible({
    timeout: 15_000,
  });
}

async function leaveCall(page: Page): Promise<void> {
  const leave = page.getByRole('button', { name: /^Salir$|^Leave call$/i });

  if (await isVisibleInViewport(leave)) await clickFirstVisible(leave);
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

function firstVoiceChannelButton(page: Page): Locator {
  return page.getByTitle(
    /Unirse (a voz|al canal de voz)|Join (voice|voice channel)/i,
  );
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

function isMobileViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 640;
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

function writeAuditReport(
  outputDirectory: string,
  metrics: AuditMetric[],
  annotations: Array<{ description?: string; type: string }>,
): void {
  writeFileSync(
    path.join(outputDirectory, 'metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
  const manifest: AuditManifest = {
    capturedStates: metrics.map(({ state }) => state),
    skippedStates: annotations
      .filter(({ type }) => type.endsWith('-skipped'))
      .map(({ description = 'No reason provided.', type }) => ({
        reason: description,
        state: type.replace(/-skipped$/, ''),
      })),
  };

  writeFileSync(
    path.join(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
