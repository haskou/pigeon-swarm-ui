import type { PigeonCallsApi } from '../../../../../contexts/calls/infrastructure/http/PigeonCallsApi';
import type { SealedCallSignal } from '../../../../../contexts/calls/infrastructure/signals/SealedCallSignal';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { CallId } from '../../../../../contexts/calls/domain/value-objects/CallId';
import { CallIdentityId } from '../../../../../contexts/calls/domain/value-objects/CallIdentityId';
import { CallSignal } from '../../../../../contexts/calls/domain/value-objects/CallSignal';
import { CallAccessContexts } from '../../../../../contexts/calls/infrastructure/http/CallAccessContexts';
import { PigeonCallSignalRepository } from '../../../../../contexts/calls/infrastructure/http/PigeonCallSignalRepository';

describe(PigeonCallSignalRepository.name, () => {
  const sealed = { signalId: 'signal-a' } as SealedCallSignal;
  const build = () => {
    const session = { identity: { id: 'identity-a' } } as Session;
    const api = {
      get: jest.fn().mockResolvedValue({
        networkId: 'network-a',
        scope: { conversationId: 'conversation-a', type: 'conversation' },
      }),
      sendSignal: jest.fn().mockResolvedValue({
        expiresAt: 200,
        signalId: 'signal-a',
      }),
    } as unknown as jest.Mocked<PigeonCallsApi>;
    const sealer = { seal: jest.fn().mockResolvedValue(sealed) };
    const contexts = new CallAccessContexts();

    contexts.register(session);

    return {
      api,
      repository: new PigeonCallSignalRepository(api, contexts, sealer),
      sealer,
      session,
    };
  };
  const signal = CallSignal.fromPrimitives({
    payload: { sdp: 'offer' },
    recipientIdentityId: 'identity-b',
    signalType: 'offer',
  });

  it('seals the signal for the call scope and posts only the sealed wire object', async () => {
    const { api, repository, sealer, session } = build();

    const delivery = await repository.create(
      CallId.fromString('call-a'),
      CallIdentityId.fromString('identity-a'),
      signal,
    );

    expect(sealer.seal).toHaveBeenCalledWith(session, {
      callId: 'call-a',
      networkId: 'network-a',
      payload: { sdp: 'offer' },
      recipientIdentityId: 'identity-b',
      scopeType: 'conversation',
      signalType: 'offer',
    });
    expect(api.sendSignal).toHaveBeenCalledWith(session, 'call-a', sealed);
    expect(delivery.toPrimitives()).toEqual({
      expiresAt: 200,
      signalId: 'signal-a',
    });
  });

  it('reads the immutable call scope once per call', async () => {
    const { api, repository } = build();
    const send = () =>
      repository.create(
        CallId.fromString('call-a'),
        CallIdentityId.fromString('identity-a'),
        signal,
      );

    await send();
    await send();

    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
