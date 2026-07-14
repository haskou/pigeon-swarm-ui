import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import { loginIdentity, openSidebar } from './support/pigeonApp';

type ConnectionStateChange = {
  at: number;
  value: string;
};

type PeerConnectionSnapshot = {
  connectionStates: ConnectionStateChange[];
  currentConnectionState: string;
  currentIceState: string;
  iceStates: ConnectionStateChange[];
  trackKinds: string[];
};

type CallResponse = {
  at: number;
  method: string;
  status: number;
  url: string;
};

type PresenceResourceResponse = {
  body: unknown;
  url: string;
};

const userA =
  process.env.VOICE_STABILITY_USER_A?.trim() ??
  process.env.VISUAL_AUDIT_CALL_USER_A?.trim();
const userB =
  process.env.VOICE_STABILITY_USER_B?.trim() ??
  process.env.VISUAL_AUDIT_CALL_USER_B?.trim();
const passwordA =
  process.env.VOICE_STABILITY_PASSWORD_A ??
  process.env.VISUAL_AUDIT_CALL_PASSWORD_A ??
  process.env.VISUAL_AUDIT_CALL_PASSWORD ??
  '';
const passwordB =
  process.env.VOICE_STABILITY_PASSWORD_B ??
  process.env.VISUAL_AUDIT_CALL_PASSWORD_B ??
  process.env.VISUAL_AUDIT_CALL_PASSWORD ??
  '';
const recoveryKeyA = process.env.VOICE_STABILITY_RECOVERY_KEY_A;
const recoveryKeyB = process.env.VOICE_STABILITY_RECOVERY_KEY_B;
const communityName = process.env.VOICE_STABILITY_COMMUNITY?.trim();
const voiceChannelName = process.env.VOICE_STABILITY_CHANNEL?.trim();
const stabilityDurationMs = Number(
  process.env.VOICE_STABILITY_DURATION_MS ?? 45_000,
);
const forceRelay = process.env.VOICE_STABILITY_FORCE_RELAY === 'true';

test('keeps two community voice participants connected', async ({}, testInfo) => {
  test.skip(
    !userA || !passwordA || !userB || !passwordB,
    'Set two existing voice-call users and their passwords.',
  );
  test.setTimeout(Math.max(600_000, stabilityDurationMs + 480_000));

  const baseURL = String(testInfo.project.use.baseURL);
  const browser = await chromium.launch({
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
    headless: true,
  });
  const contextA = await createCallContext(browser, baseURL);
  const contextB = await createCallContext(browser, baseURL);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const responsesA = trackCallResponses(pageA);
  const responsesB = trackCallResponses(pageB);
  const presenceResourcesB = trackPresenceResourceResponses(pageB);
  const realtimeEventsA = trackCallRealtimeEvents(pageA);
  const realtimeEventsB = trackCallRealtimeEvents(pageB);

  if (forceRelay) {
    await Promise.all([forceRelayTransport(pageA), forceRelayTransport(pageB)]);
  }

  try {
    await test.step('login existing user A', async () => {
      await loginIdentity(pageA, userA!, passwordA, recoveryKeyA);
    });
    const selectedCommunityName = await openCommunity(pageA, communityName);
    const selectedChannelName = await joinVoiceChannel(pageA, voiceChannelName);

    await test.step('hydrate existing voice presence on initial load', async () => {
      await loginIdentity(pageB, userB!, passwordB, recoveryKeyB);
      await openCommunity(pageB, selectedCommunityName);
      await expect(
        pageB
          .getByTestId('voice-channel-participant')
          .filter({ hasText: /Hask/i })
          .first(),
        `Initial presence resources: ${JSON.stringify(presenceResourcesB)}`,
      ).toBeVisible({ timeout: 45_000 });
    });

    await joinVoiceChannel(pageB, selectedChannelName);

    await Promise.all([
      waitForConnectedPeer(pageA),
      waitForConnectedPeer(pageB),
    ]);
    await Promise.all([openCallStage(pageA), openCallStage(pageB)]);

    const startedAt = Date.now();

    while (Date.now() - startedAt < stabilityDurationMs) {
      await assertConnectedWithoutDrop(pageA);
      await assertConnectedWithoutDrop(pageB);
      await assertParticipantTilesStayConnected(pageA);
      await assertParticipantTilesStayConnected(pageB);
      await pageA.waitForTimeout(
        Math.min(5_000, stabilityDurationMs - (Date.now() - startedAt)),
      );
    }

    assertHeartbeatResponses(responsesA, stabilityDurationMs);
    assertHeartbeatResponses(responsesB, stabilityDurationMs);
    assertStableCallTraffic(responsesA, realtimeEventsA, startedAt);
    assertStableCallTraffic(responsesB, realtimeEventsB, startedAt);
  } finally {
    await Promise.all([leaveCall(pageA), leaveCall(pageB)]);
    await Promise.all([contextA.close(), contextB.close()]);
    await browser.close();
  }
});

async function forceRelayTransport(page: Page): Promise<void> {
  await page.route('**/calls/ice-servers', async (route) => {
    const response = await route.fetch();
    const configuration = (await response.json()) as Record<string, unknown>;

    await route.fulfill({
      json: { ...configuration, iceTransportPolicy: 'relay' },
      response,
    });
  });
}

function trackPresenceResourceResponses(
  page: Page,
): PresenceResourceResponse[] {
  const responses: PresenceResourceResponse[] = [];

  page.on('response', (response) => {
    const url = new URL(response.url()).pathname;

    if (
      url !== '/calls/' &&
      !/^\/communities\/[^/]+\/channels$/.test(url)
    ) {
      return;
    }

    void response
      .json()
      .then((body: unknown) => responses.push({ body, url }))
      .catch(() => undefined);
  });

  return responses;
}

async function createCallContext(
  browser: Browser,
  baseURL: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL,
    permissions: ['microphone'],
    viewport: { height: 900, width: 1440 },
  });

  await context.addInitScript(() => {
    window.localStorage.setItem('pigeon-swarm-language-v2', 'en');
    window.localStorage.setItem('pigeon-swarm-language-explicit-v3', 'true');
    window.localStorage.removeItem('pigeon-swarm-credentials');

    const nativePeerConnection = window.RTCPeerConnection;
    const snapshots: PeerConnectionSnapshot[] = [];
    const trackedWindow = window as typeof window & {
      __pigeonE2ePeerConnections?: PeerConnectionSnapshot[];
    };

    trackedWindow.__pigeonE2ePeerConnections = snapshots;

    class TrackedPeerConnection extends nativePeerConnection {
      public constructor(configuration?: RTCConfiguration) {
        super(configuration);

        const snapshot: PeerConnectionSnapshot = {
          connectionStates: [],
          currentConnectionState: this.connectionState,
          currentIceState: this.iceConnectionState,
          iceStates: [],
          trackKinds: [],
        };
        const recordConnectionState = (): void => {
          snapshot.currentConnectionState = this.connectionState;
          snapshot.connectionStates.push({
            at: Date.now(),
            value: this.connectionState,
          });
        };
        const recordIceState = (): void => {
          snapshot.currentIceState = this.iceConnectionState;
          snapshot.iceStates.push({
            at: Date.now(),
            value: this.iceConnectionState,
          });
        };

        snapshots.push(snapshot);
        recordConnectionState();
        recordIceState();
        this.addEventListener('connectionstatechange', recordConnectionState);
        this.addEventListener('iceconnectionstatechange', recordIceState);
        this.addEventListener('track', (event) => {
          snapshot.trackKinds.push(event.track.kind);
        });
      }
    }

    Object.defineProperty(window, 'RTCPeerConnection', {
      configurable: true,
      value: TrackedPeerConnection,
      writable: true,
    });
  });

  return context;
}

async function openCommunity(
  page: Page,
  expectedCommunityName?: string,
): Promise<string> {
  await openSidebar(page);
  const communityButton = expectedCommunityName
    ? page.getByRole('button', { exact: true, name: expectedCommunityName })
    : firstCommunityButton(page);

  await expect(communityButton.first()).toBeVisible({ timeout: 30_000 });
  const selectedCommunityName =
    (await communityButton.first().getAttribute('aria-label')) ??
    (await communityButton.first().getAttribute('title')) ??
    (await communityButton.first().innerText()).trim();

  await communityButton.first().click();
  await expect(firstVoiceChannelButton(page)).toBeVisible({ timeout: 30_000 });

  return selectedCommunityName;
}

async function joinVoiceChannel(
  page: Page,
  expectedChannelName?: string,
): Promise<string> {
  const voiceChannel = expectedChannelName
    ? firstVoiceChannelButton(page).filter({ hasText: expectedChannelName })
    : firstVoiceChannelButton(page);

  await expect(voiceChannel.first()).toBeVisible({ timeout: 30_000 });
  const channelName = (await voiceChannel.first().innerText()).trim();

  await voiceChannel.first().click();
  await expect(page.getByTestId('compact-call-bar')).toBeVisible({
    timeout: 45_000,
  });

  return channelName;
}

async function waitForConnectedPeer(page: Page): Promise<void> {
  await expect
    .poll(async () => peerConnectionReadiness(page), { timeout: 60_000 })
    .toEqual({
      connectionCount: 1,
      connected: true,
      hasRemoteAudio: true,
    });
}

async function openCallStage(page: Page): Promise<void> {
  await page.getByTestId('compact-call-bar').dispatchEvent('click');
  await expect(page.getByTestId('call-stage-dialog')).toBeVisible({
    timeout: 30_000,
  });
  await expect(connectionQualityButtons(page)).toHaveCount(2, {
    timeout: 30_000,
  });
}

async function assertParticipantTilesStayConnected(page: Page): Promise<void> {
  const qualityLabels = await connectionQualityButtons(page).allTextContents();

  expect(qualityLabels).toHaveLength(2);
  expect(
    qualityLabels.some((label) => /Connecting|Conectando/i.test(label)),
  ).toBe(false);
  expect(
    qualityLabels.some((label) => /Poor connection|Mala conexion/i.test(label)),
  ).toBe(false);
}

function connectionQualityButtons(page: Page) {
  return page.getByRole('button', {
    name: /Good connection|Weak connection|Poor connection|Connecting|Buena conexion|Conexion debil|Mala conexion|Conectando/i,
  });
}

async function assertConnectedWithoutDrop(page: Page): Promise<void> {
  const snapshots = await peerConnectionSnapshots(page);

  expect(
    snapshots,
    'one peer connection must exist per remote participant',
  ).toHaveLength(1);

  for (const snapshot of snapshots) {
    expect(snapshot.currentConnectionState).toBe('connected');
    expect(snapshot.currentIceState).toBe('connected');
    expect(snapshot.trackKinds).toContain('audio');
    expect(
      snapshot.connectionStates.some(({ value }) =>
        ['closed', 'disconnected', 'failed'].includes(value),
      ),
    ).toBe(false);
    expect(
      snapshot.iceStates.some(({ value }) =>
        ['closed', 'disconnected', 'failed'].includes(value),
      ),
    ).toBe(false);
  }
}

async function peerConnectionReadiness(page: Page): Promise<{
  connected: boolean;
  connectionCount: number;
  hasRemoteAudio: boolean;
}> {
  const snapshots = await peerConnectionSnapshots(page);

  return {
    connected:
      snapshots.length === 1 &&
      snapshots.every(
        ({ currentConnectionState, currentIceState }) =>
          currentConnectionState === 'connected' &&
          currentIceState === 'connected',
      ),
    connectionCount: snapshots.length,
    hasRemoteAudio:
      snapshots.length === 1 &&
      snapshots.every(({ trackKinds }) => trackKinds.includes('audio')),
  };
}

async function peerConnectionSnapshots(
  page: Page,
): Promise<PeerConnectionSnapshot[]> {
  return await page.evaluate(() => {
    const trackedWindow = window as typeof window & {
      __pigeonE2ePeerConnections?: PeerConnectionSnapshot[];
    };

    return trackedWindow.__pigeonE2ePeerConnections ?? [];
  });
}

function trackCallResponses(page: Page): CallResponse[] {
  const responses: CallResponse[] = [];

  page.on('response', (response) => {
    if (!response.url().includes('/calls/')) return;

    responses.push({
      at: Date.now(),
      method: response.request().method(),
      status: response.status(),
      url: new URL(response.url()).pathname,
    });
  });

  return responses;
}

function assertStableCallTraffic(
  responses: CallResponse[],
  realtimeEvents: string[],
  stablePeriodStartedAt: number,
): void {
  const stableResponses = responses.filter(
    ({ at }) => at >= stablePeriodStartedAt,
  );
  const callResourceReads = stableResponses.filter(
    ({ method, url }) => method === 'GET' && /^\/calls\/[^/]+$/.test(url),
  );
  const communityChannelReads = stableResponses.filter(
    ({ method, url }) =>
      method === 'GET' && /^\/communities\/[^/]+\/channels$/.test(url),
  );

  expect(
    callResourceReads.length,
    `Realtime call events: ${JSON.stringify(eventCounts(realtimeEvents))}`,
  ).toBeLessThanOrEqual(2);
  expect(communityChannelReads.length).toBeLessThanOrEqual(1);
}

function trackCallRealtimeEvents(page: Page): string[] {
  const events: string[] = [];

  page.on('console', (message) => {
    const text = message.text();

    if (!text.startsWith('[pigeon realtime] domain_event calls.')) return;

    const eventType = text.split(' ')[3];

    if (eventType) events.push(eventType);
  });

  return events;
}

function eventCounts(events: string[]): Record<string, number> {
  return events.reduce<Record<string, number>>((counts, event) => {
    counts[event] = (counts[event] ?? 0) + 1;

    return counts;
  }, {});
}

function assertHeartbeatResponses(
  responses: CallResponse[],
  durationMs: number,
): void {
  const heartbeats = responses.filter(({ url }) =>
    url.endsWith('/participants/me/heartbeat'),
  );
  const expectedMinimum = Math.max(2, Math.floor(durationMs / 4_000));

  expect(heartbeats.length).toBeGreaterThanOrEqual(expectedMinimum);
  expect(heartbeats.every(({ status }) => status >= 200 && status < 300)).toBe(
    true,
  );
}

async function leaveCall(page: Page): Promise<void> {
  const leaveButtons = page.getByRole('button', { name: /^Leave call$/i });

  for (let index = 0; index < (await leaveButtons.count()); index += 1) {
    const leaveButton = leaveButtons.nth(index);

    if (!(await leaveButton.isVisible().catch(() => false))) continue;

    await leaveButton
      .click({ force: true, timeout: 5_000 })
      .catch(() => undefined);

    return;
  }
}

function firstCommunityButton(page: Page) {
  return page
    .locator('aside button[title][aria-label]:not([aria-busy])')
    .filter({
      hasNotText: /Add community|Install/i,
    });
}

function firstVoiceChannelButton(page: Page) {
  return page.getByTitle(/Join (voice|voice channel)/i);
}
