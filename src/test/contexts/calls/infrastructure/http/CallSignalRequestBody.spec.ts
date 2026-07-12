import { CallSignalRequestBody } from '../../../../../contexts/calls/infrastructure/http/CallSignalRequestBody';

describe(CallSignalRequestBody.name, () => {
  it('serializes a signal below the transport limit', () => {
    const request = new CallSignalRequestBody({
      payload: { candidate: 'candidate' },
      recipientIdentityId: 'identity-2',
      signalType: 'ice_candidate',
    });

    expect(request.body()).toEqual({
      payload: { candidate: 'candidate' },
      recipientIdentityId: 'identity-2',
      signalType: 'ice_candidate',
    });
  });

  it('rejects a signal at or above the 64 KiB transport limit', () => {
    expect(
      () =>
        new CallSignalRequestBody({
          payload: { sdp: 'x'.repeat(64 * 1024) },
          recipientIdentityId: 'identity-2',
          signalType: 'offer',
        }),
    ).toThrow('64 KiB');
  });
});
