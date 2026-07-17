import type { PigeonCallsApi } from '../../../../../contexts/calls/infrastructure/http/PigeonCallsApi';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { CallId } from '../../../../../contexts/calls/domain/value-objects/CallId';
import { CallIdentityId } from '../../../../../contexts/calls/domain/value-objects/CallIdentityId';
import { CallSignal } from '../../../../../contexts/calls/domain/value-objects/CallSignal';
import { CallAccessContexts } from '../../../../../contexts/calls/infrastructure/http/CallAccessContexts';
import { PigeonCallSignalRepository } from '../../../../../contexts/calls/infrastructure/http/PigeonCallSignalRepository';

describe(PigeonCallSignalRepository.name, () => {
  it('serializes the signal only at the HTTP boundary', async () => {
    const session = { identity: { id: 'identity-a' } } as Session;
    const api = {
      sendSignal: jest.fn().mockResolvedValue({
        expiresAt: 200,
        signalId: 'signal-a',
      }),
    } as unknown as jest.Mocked<PigeonCallsApi>;
    const contexts = new CallAccessContexts();
    contexts.register(session);
    const repository = new PigeonCallSignalRepository(api, contexts);

    const delivery = await repository.create(
      CallId.fromString('call-a'),
      CallIdentityId.fromString('identity-a'),
      CallSignal.fromPrimitives({
        payload: { sdp: 'offer' },
        recipientIdentityId: 'identity-b',
        signalType: 'offer',
      }),
    );

    expect(api.sendSignal).toHaveBeenCalledWith(session, 'call-a', {
      payload: { sdp: 'offer' },
      recipientIdentityId: 'identity-b',
      signalType: 'offer',
    });
    expect(delivery.toPrimitives()).toEqual({
      expiresAt: 200,
      signalId: 'signal-a',
    });
  });
});
