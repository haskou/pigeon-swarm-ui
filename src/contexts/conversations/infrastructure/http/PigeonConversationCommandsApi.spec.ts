import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestCache } from '../../../../shared/infrastructure/http/RequestCache';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { ConversationIdFactory } from '../../domain/ConversationIdFactory';
import { ConversationMapper } from './ConversationMapper';
import { PigeonConversationCommandsApi } from './PigeonConversationCommandsApi';

describe(PigeonConversationCommandsApi.name, () => {
  it('rejects invitations when the conversation key is not available', async () => {
    const api = new PigeonConversationCommandsApi(
      {} as HttpJsonClient,
      {} as RequestSigner,
      new ConversationMapper(),
      new ConversationIdFactory(),
      { get: jest.fn() },
      { publish: jest.fn() },
      {} as RequestCache,
    );
    const session = {
      identity: { id: 'identity-1' },
      keychain: { conversations: {}, version: 1 },
    } as unknown as Session;

    await expect(
      api.invite(session, 'conversation-1', 'identity-2'),
    ).rejects.toThrow('Conversation key is required.');
  });
});
