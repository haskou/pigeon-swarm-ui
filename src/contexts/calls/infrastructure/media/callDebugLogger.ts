type DiagnosticEvent = {
  context: Record<string, number | string>;
  elapsedMs: number;
  event: string;
  level: 'debug' | 'error' | 'warning';
};

const allowedEvents = new Set([
  'peer-manager:connection-state-change',
  'peer-manager:ice-connection-state-change',
  'peer-manager:signaling-state-change',
  'peer-manager:ice-recovery:scheduled',
  'peer-manager:ice-recovery:configuration-unavailable',
  'peer-manager:ice-recovery:exhausted',
  'peer-manager:ice-recovery:manual-retry',
  'peer-manager:create-peer',
  'peer-manager:track-received',
  'peer-manager:reset',
]);
const allowedStates: Record<string, readonly string[]> = {
  connectionState: [
    'new',
    'connecting',
    'connected',
    'disconnected',
    'failed',
    'closed',
  ],
  iceConnectionState: [
    'new',
    'checking',
    'connected',
    'completed',
    'disconnected',
    'failed',
    'closed',
  ],
  signalingState: [
    'stable',
    'have-local-offer',
    'have-remote-offer',
    'have-local-pranswer',
    'have-remote-pranswer',
    'closed',
  ],
};
let startedAt: number | undefined;
let expires: ReturnType<typeof setTimeout> | undefined;
let events: DiagnosticEvent[] = [];

function isBoundedMetric(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 60_000
  );
}

function safeContext(
  context: Record<string, unknown>,
): DiagnosticEvent['context'] {
  const safe: DiagnosticEvent['context'] = {};
  for (const key of ['attempt', 'delay']) {
    const value = context[key];

    if (isBoundedMetric(value)) safe[key] = value;
  }
  for (const [key, values] of Object.entries(allowedStates)) {
    const value = context[key];

    if (typeof value === 'string' && values.includes(value)) safe[key] = value;
  }

  return safe;
}

export function stopCallDiagnostics(): void {
  clearTimeout(expires);
  expires = undefined;
  startedAt = undefined;
  events = [];
}

function record(
  level: DiagnosticEvent['level'],
  event: string,
  context: Record<string, unknown>,
): void {
  if (startedAt === undefined) return;

  if (Date.now() - startedAt >= 300_000) {
    stopCallDiagnostics();

    return;
  }

  if (!allowedEvents.has(event)) return;
  events.push({
    context: safeContext(context),
    elapsedMs: Math.max(0, Date.now() - startedAt),
    event,
    level,
  });

  if (events.length > 200) events.shift();
}

export function startCallDiagnostics(): void {
  stopCallDiagnostics();
  startedAt = Date.now();
  expires = setTimeout(stopCallDiagnostics, 300_000);
}

export function readCallDiagnostics(): {
  active: boolean;
  events: DiagnosticEvent[];
} {
  if (startedAt !== undefined && Date.now() - startedAt >= 300_000)
    stopCallDiagnostics();

  return {
    active: startedAt !== undefined,
    events: events.map((event) => ({
      ...event,
      context: { ...event.context },
    })),
  };
}

export function logCallDebug(
  event: string,
  context: Record<string, unknown> = {},
): void {
  record('debug', event, context);
}

export function logCallWarning(
  event: string,
  context: Record<string, unknown> = {},
): void {
  record('warning', event, context);
}

export function logCallError(
  event: string,
  _error: unknown,
  context: Record<string, unknown> = {},
): void {
  record('error', event, context);
}
