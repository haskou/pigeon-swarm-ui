import type { CallSession } from '../view-models/CallSession';

import { readCallDiagnostics } from '../../infrastructure/media/callDebugLogger';

function finiteMetric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function knownValue(
  value: unknown,
  values: readonly string[],
): string | undefined {
  return typeof value === 'string' && values.includes(value)
    ? value
    : undefined;
}

export function callDiagnosticReport(call: CallSession) {
  return {
    version: 1,
    diagnostics: readCallDiagnostics(),
    microphoneAvailable: call.hasMicrophone === true,
    participants: call.participants.map((participant) => ({
      local: participant.identityId === call.currentIdentityId,
      bitrateKbps: finiteMetric(participant.bitrateKbps),
      connectionPath: knownValue(participant.connectionPath, [
        'direct',
        'relay',
        'unknown',
      ]),
      connectionState: knownValue(participant.connectionState, [
        'new',
        'connecting',
        'connected',
        'disconnected',
        'failed',
        'closed',
      ]),
      iceState: knownValue(participant.iceState, [
        'new',
        'checking',
        'connected',
        'completed',
        'disconnected',
        'failed',
        'closed',
      ]),
      jitterMs: finiteMetric(participant.jitterMs),
      latencyMs: finiteMetric(participant.latencyMs),
      mediaEncryptionActive: participant.mediaEncryptionActive === true,
      packetsLost: finiteMetric(participant.packetsLost),
      recoveryState: knownValue(participant.recoveryState, [
        'idle',
        'recovering',
        'exhausted',
      ]),
      transport: knownValue(participant.transport, ['tcp', 'udp']),
    })),
  };
}
