import {
  logCallDebug,
  logCallError,
  logCallWarning,
  startCallDiagnostics,
  stopCallDiagnostics,
  readCallDiagnostics,
} from '../../../../../contexts/calls/infrastructure/media/callDebugLogger';

describe('call diagnostics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    stopCallDiagnostics();
  });
  afterEach(() => {
    stopCallDiagnostics();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not log or retain anything without explicit capture', () => {
    const debug = jest.spyOn(console, 'debug');
    const warn = jest.spyOn(console, 'warn');
    const error = jest.spyOn(console, 'error');
    logCallDebug('peer-manager:connection-state-change', {
      peerIdentityId: 'private',
    });
    logCallWarning('peer-manager:ice-recovery:scheduled', { attempt: 1 });
    logCallError(
      'peer-manager:create-peer:configuration-failed',
      new Error('secret'),
    );
    expect(readCallDiagnostics()).toEqual({ active: false, events: [] });
    expect(debug).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('captures only allowlisted event names and finite metrics or enums', () => {
    startCallDiagnostics();
    logCallWarning('peer-manager:ice-recovery:scheduled', {
      attempt: 2,
      candidate: '192.0.2.42',
      connectionState: 'failed',
      credential: 'turn-secret',
      delay: 15000,
      iceConnectionState: 'checking',
      nested: { token: 'token-secret' },
      peerIdentityId: 'identity-secret',
      sdp: 'sdp-secret',
    });
    logCallError(
      'peer-manager:connection-state-change',
      new Error('error-secret'),
      {
        attempt: Infinity,
        connectionState: 'secret-state',
        delay: 'secret-delay',
      },
    );
    logCallDebug('secret-event-name', { attempt: 1 });
    const capture = readCallDiagnostics();
    expect(capture.active).toBe(true);
    expect(capture.events).toEqual([
      {
        context: {
          attempt: 2,
          connectionState: 'failed',
          delay: 15000,
          iceConnectionState: 'checking',
        },
        elapsedMs: 0,
        event: 'peer-manager:ice-recovery:scheduled',
        level: 'warning',
      },
      {
        context: {},
        elapsedMs: 0,
        event: 'peer-manager:connection-state-change',
        level: 'error',
      },
    ]);
    expect(JSON.stringify(capture)).not.toMatch(/secret|192\.0\.2\.42/);
  });

  it('bounds capture size, expires after five minutes and clears on stop', () => {
    startCallDiagnostics();
    for (let attempt = 0; attempt < 250; attempt++)
      logCallWarning('peer-manager:ice-recovery:scheduled', { attempt: 1 });
    expect(readCallDiagnostics().events).toHaveLength(200);
    jest.advanceTimersByTime(300_000);
    expect(readCallDiagnostics()).toEqual({ active: false, events: [] });
    startCallDiagnostics();
    logCallWarning('peer-manager:ice-recovery:scheduled');
    stopCallDiagnostics();
    expect(readCallDiagnostics()).toEqual({ active: false, events: [] });
    expect(jest.getTimerCount()).toBe(0);
  });
});
