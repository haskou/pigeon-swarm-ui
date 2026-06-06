#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const url = process.env.PIGEON_STARTUP_URL ?? 'http://localhost:5175/';
const identityId = process.env.PIGEON_STARTUP_IDENTITY_ID ?? '';
const password = process.env.PIGEON_STARTUP_PASSWORD ?? '';
const workspaceMode = process.env.PIGEON_STARTUP_WORKSPACE_MODE ?? 'messages';
const communityId = process.env.PIGEON_STARTUP_COMMUNITY_ID ?? '';
const channelId = process.env.PIGEON_STARTUP_CHANNEL_ID ?? '';
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pigeon-startup-report-'));

if (!identityId || !password) {
  console.error(
    'Set PIGEON_STARTUP_IDENTITY_ID and PIGEON_STARTUP_PASSWORD before running this script.',
  );
  process.exit(1);
}

const configPath = path.join(outDir, 'playwright.config.cjs');
const specPath = path.join(outDir, 'startup.spec.cjs');
const playwrightNodePath = findPlaywrightNodePath();

fs.writeFileSync(
  configPath,
  `module.exports = { timeout: 30000, use: { trace: 'off', video: 'off' } };\n`,
);
fs.writeFileSync(
  specPath,
  `
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.use({ channel: 'chrome', viewport: { width: 1365, height: 768 } });

test('startup report', async ({ page }) => {
  const outDir = ${JSON.stringify(outDir)};
  const timeline = [];
  const consoleErrors = [];
  const requests = [];
  const start = Date.now();

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleErrors.push(msg.type() + ': ' + msg.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push('pageerror: ' + error.message);
  });
  page.on('request', (request) => {
    const requestUrl = request.url();
    if (requestUrl.includes('/api/')) {
      requests.push({ event: 'request', method: request.method(), timestampMs: Date.now() - start, url: requestUrl });
    }
  });

  await page.addInitScript((input) => {
    localStorage.setItem('pigeon-swarm-credentials', JSON.stringify({
      identityId: input.identityId,
      password: input.password,
    }));
    if (input.workspaceMode === 'community' && input.communityId) {
      localStorage.setItem(
        'pigeon:workspace:' + input.identityId,
        JSON.stringify({
          channelByCommunityId: input.channelId ? { [input.communityId]: input.channelId } : {},
          communityId: input.communityId,
          mode: 'community',
        }),
      );
    }
  }, ${JSON.stringify({ channelId, communityId, identityId, password, workspaceMode })});

  async function sample(label) {
    const state = await page.evaluate(() => {
      const text = document.body.innerText.replace(/\\s+/g, ' ').trim();
      return {
        hasCommunity: /Canales de texto|# general|Comunidad privada|Comunidad publica/i.test(text),
        hasEmptyCommunities: /No hay comunidades todavía/i.test(text),
        hasLoadingSurface: Boolean(document.querySelector('[aria-busy="true"]')),
        hasMessages: /Mensajes directos|Nueva conversación|Escribe un mensaje/i.test(text),
        text: text.slice(0, 300),
      };
    });
    timeline.push({ label, state, timestampMs: Date.now() - start });
  }

  await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded' });
  for (const delay of [0, 120, 240, 400, 700, 1100, 1600, 2300]) {
    const previousTimestamp = timeline.at(-1)?.timestampMs ?? 0;
    const nextWait = Math.max(0, delay - previousTimestamp);
    if (nextWait > 0) await page.waitForTimeout(nextWait);
    await sample(delay + 'ms');
    await page.screenshot({ path: path.join(outDir, String(delay).padStart(4, '0') + '.png') });
  }
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await sample('networkidle-or-timeout');
  await page.screenshot({ path: path.join(outDir, 'final.png') });

  const sawFalseEmpty = timeline.some((entry) => entry.state.hasEmptyCommunities);
  const report = {
    consoleErrors,
    finalUrl: page.url(),
    pageTitle: await page.title(),
    requests,
    sawFalseEmpty,
    screenshotPaths: fs.readdirSync(outDir).filter((file) => file.endsWith('.png')).map((file) => path.join(outDir, file)),
    timeline,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  expect(sawFalseEmpty).toBe(false);
});
`,
);

const result = spawnSync(
  'npx',
  [
    '-y',
    '-p',
    '@playwright/test',
    'playwright',
    'test',
    '--config',
    configPath,
    specPath,
  ],
  {
    env: {
      ...process.env,
      NODE_PATH: [playwrightNodePath, process.env.NODE_PATH]
        .filter(Boolean)
        .join(path.delimiter),
    },
    stdio: 'inherit',
  },
);

console.log(`Startup report written to ${outDir}`);
process.exit(result.status ?? 1);

function findPlaywrightNodePath() {
  const npxCacheDir = path.join(os.homedir(), '.npm', '_npx');

  try {
    for (const entry of fs.readdirSync(npxCacheDir)) {
      const nodeModules = path.join(npxCacheDir, entry, 'node_modules');
      const playwrightTest = path.join(
        nodeModules,
        '@playwright',
        'test',
      );

      if (fs.existsSync(playwrightTest)) {
        return nodeModules;
      }
    }
  } catch {
    return '';
  }

  return '';
}
