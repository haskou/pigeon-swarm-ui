import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';

import { callDiagnosticReport } from '../../../../../contexts/calls/presentation/components/callDiagnosticReport';

describe('call diagnostic report', () => {
  it('excludes the call resource, identifiers, names, arbitrary strings and non-finite metrics', () => {
    const call = {
      call: {
        key: 'private-key',
        participants: [{ identityId: 'private-identity' }],
      },
      communityId: 'private-community',
      conversationId: 'private-conversation',
      currentIdentityId: 'private-identity',
      hasMicrophone: true,
      id: 'private-call',
      participants: [
        {
          bitrateKbps: 64,
          codec: 'private-codec',
          connectionState: 'connected',
          iceState: 'completed',
          identityId: 'private-identity',
          jitterMs: NaN,
          latencyMs: Infinity,
          name: 'private-name',
          packetsLost: 0,
          recoveryState: 'idle',
          transport: 'private-address',
        },
      ],
      title: 'private-title',
    } as unknown as CallSession;
    const report = callDiagnosticReport(call);
    expect(JSON.stringify(report)).not.toContain('private');
    expect(report.participants[0]).toMatchObject({
      bitrateKbps: 64,
      connectionState: 'connected',
      iceState: 'completed',
      local: true,
    });
    expect(report.participants[0].transport).toBeUndefined();
    expect(report.participants[0].latencyMs).toBeUndefined();
    expect(report.participants[0].jitterMs).toBeUndefined();
  });
});
