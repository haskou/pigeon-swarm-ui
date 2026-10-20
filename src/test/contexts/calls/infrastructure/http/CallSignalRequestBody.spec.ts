import type { SealedCallSignal } from '../../../../../contexts/calls/infrastructure/signals/SealedCallSignal';

import { CallSignalRequestBody } from '../../../../../contexts/calls/infrastructure/http/CallSignalRequestBody';

const signal = (envelope = 'envelope'): SealedCallSignal => ({
  callId: 'call-a',
  createdAt: 1,
  expiresAt: 20_001,
  networkId: 'network-a',
  recipientIdentityId: 'identity-2',
  scopeType: 'conversation',
  sealedEntries: [{ envelope, recipientDeviceCredential: 'device-2' }],
  senderDeviceCredential: 'device-1',
  senderIdentityId: 'identity-1',
  signalId: 'signal-a',
  signalType: 'ice_candidate',
  signature: 'sig',
});

describe(CallSignalRequestBody.name, () => {
  it('serializes the sealed wire object with no payload', () => {
    const request = new CallSignalRequestBody(signal());

    expect(request.body()).toEqual(signal());
    expect(request.body()).not.toHaveProperty('payload');
  });

  it('rejects a signal at or above the 64 KiB transport limit', () => {
    expect(
      () => new CallSignalRequestBody(signal('x'.repeat(64 * 1024))),
    ).toThrow('64 KiB');
  });
});
