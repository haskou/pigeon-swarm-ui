import type { MessageSignaturePayloadFactory } from '../../../../../contexts/messages/domain/MessageSignaturePayloadFactory';
import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type { MessageAttachmentPublisher } from '../../../../../contexts/messages/infrastructure/http/MessageAttachmentPublisher';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { PigeonMessagesApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesApi';

describe(PigeonMessageCommandsApi.name, () => {
  const session = {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;

  const commandApi = () =>
    new PigeonMessageCommandsApi(
      {
        request: jest.fn(),
        requestBlob: jest.fn(),
      } as unknown as HttpJsonClient,
      { headers: jest.fn() } as unknown as RequestSigner,
      {} as PigeonMessagesApi,
      {} as MessageProjectionPort,
      {} as MessageAttachmentPublisher,
      {} as MessageSignaturePayloadFactory,
    );

  it('rejects sending when the conversation key is unavailable', async () => {
    await expect(
      commandApi().send(session, 'conversation-1', 'Hello'),
    ).rejects.toThrow('Conversation key is required.');
  });

  it('rejects editing when the conversation key is unavailable', async () => {
    await expect(
      commandApi().edit(session, 'conversation-1', 'message-1', 'Updated'),
    ).rejects.toThrow('Conversation key is required.');
  });
});
