import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type { MessageAttachmentPublisher } from '../../../../../contexts/messages/infrastructure/http/MessageAttachmentPublisher';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { PigeonMessagesApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import { PublicMutationSigner } from '../../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

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
      {} as PublicMutationSigner,
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

  it('signs a delete as a put of its own deleted record', async () => {
    const request = jest.fn().mockResolvedValue(undefined);
    const api = new PigeonMessageCommandsApi(
      { request } as unknown as HttpJsonClient,
      { headers: jest.fn().mockResolvedValue({}) } as unknown as RequestSigner,
      {} as PigeonMessagesApi,
      {} as MessageProjectionPort,
      {} as MessageAttachmentPublisher,
      publicMutationSignerAt(),
    );
    const signed = {
      deviceCredentialKeyPair: await KeyPair.generate(),
      identity: { id: 'identity-1' },
    } as unknown as Session;

    await api.delete(signed, 'conversation-1', 'message-1', {
      createdAt: 5,
      id: 'unused',
    });

    const body = JSON.parse(request.mock.calls[0][1].body as string) as {
      id: string;
      mutation: Record<string, unknown>;
      signature?: string;
    };

    expect(body.signature).toBeUndefined();
    expect(body.mutation).toMatchObject({
      kind: 'put',
      recordId: body.id,
      sequence: 0,
      store: 'messages',
    });
  });
});
