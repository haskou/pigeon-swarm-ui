import type { PigeonCallsApi } from '../../../../../contexts/calls/infrastructure/http/PigeonCallsApi';
import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { CallId } from '../../../../../contexts/calls/domain/value-objects/CallId';
import { CallIdentityId } from '../../../../../contexts/calls/domain/value-objects/CallIdentityId';
import { CallScope } from '../../../../../contexts/calls/domain/value-objects/CallScope';
import { CallScopeIdentifier } from '../../../../../contexts/calls/domain/value-objects/CallScopeIdentifier';
import { CallAccessContexts } from '../../../../../contexts/calls/infrastructure/http/CallAccessContexts';
import { CallMapper } from '../../../../../contexts/calls/infrastructure/http/CallMapper';
import { PigeonCallRepository } from '../../../../../contexts/calls/infrastructure/http/PigeonCallRepository';

const resource: CallResource = {
  createdAt: 1,
  creatorIdentityId: 'identity-a',
  id: 'call-a',
  networkId: 'network-a',
  participantIds: ['identity-a'],
  participants: [
    {
      connected: true,
      identityId: 'identity-a',
      mediaConnections: [],
      status: 'joined',
    },
  ],
  scope: { conversationId: 'conversation-a', type: 'conversation' },
  status: 'active',
};

describe(PigeonCallRepository.name, () => {
  it('maps reads and writes while resolving authentication in infrastructure', async () => {
    const session = { identity: { id: 'identity-a' } } as Session;
    const api = {
      end: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(resource),
      heartbeat: jest.fn().mockResolvedValue(resource),
      join: jest.fn().mockResolvedValue(resource),
      leave: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([resource]),
      startCommunityChannel: jest.fn().mockResolvedValue(resource),
      startConversation: jest.fn().mockResolvedValue(resource),
    } as unknown as jest.Mocked<PigeonCallsApi>;
    const contexts = new CallAccessContexts();
    contexts.register(session);
    const repository = new PigeonCallRepository(
      api,
      contexts,
      new CallMapper(),
    );
    const actorId = CallIdentityId.fromString('identity-a');
    const call = await repository.find(CallId.fromString('call-a'), actorId);

    await expect(repository.search(actorId)).resolves.toHaveLength(1);
    await repository.create(
      CallScope.conversation(CallScopeIdentifier.fromString('conversation-a')),
      actorId,
    );
    await repository.join(call, actorId);
    await repository.heartbeat(call, actorId, []);
    await repository.leave(call, actorId);
    await repository.end(call, actorId);

    expect(api.get).toHaveBeenCalledWith(session, 'call-a');
    expect(api.startConversation).toHaveBeenCalledWith(
      session,
      'conversation-a',
    );
    expect(api.heartbeat).toHaveBeenCalledWith(session, 'call-a', []);
  });

  it('routes community channel creation through its endpoint', async () => {
    const session = { identity: { id: 'identity-a' } } as Session;
    const api = {
      startCommunityChannel: jest.fn().mockResolvedValue(resource),
    } as unknown as jest.Mocked<PigeonCallsApi>;
    const contexts = new CallAccessContexts();
    contexts.register(session);
    const repository = new PigeonCallRepository(
      api,
      contexts,
      new CallMapper(),
    );

    await repository.create(
      CallScope.communityChannel(
        CallScopeIdentifier.fromString('community-a'),
        CallScopeIdentifier.fromString('channel-a'),
      ),
      CallIdentityId.fromString('identity-a'),
    );

    expect(api.startCommunityChannel).toHaveBeenCalledWith(
      session,
      'community-a',
      'channel-a',
    );
  });
});
