import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { MessageProjectionPort } from '../../../../../contexts/messages/infrastructure/crypto/MessageProjectionPort';
import type { MessageAttachmentPublisher } from '../../../../../contexts/messages/infrastructure/http/MessageAttachmentPublisher';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { PigeonMessagesApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessagesApi';
import { PublicMutationSigner } from '../../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';
import { ScopeFrontierReader } from '../../../../../shared/infrastructure/http/ScopeFrontierReader';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

beforeEach(() => {
  jest
    .spyOn(ScopeFrontierReader.prototype, 'community')
    .mockResolvedValue(['F'.repeat(43)]);
  jest
    .spyOn(ScopeFrontierReader.prototype, 'conversation')
    .mockResolvedValue(['F'.repeat(43)]);
});

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

  describe('sending with attachments', () => {
    const conversationKey = {
      algorithm: 'aes-256-gcm',
      conversationId: 'conversation-1',
      createdAt: 1,
      key: Buffer.alloc(32, 7).toString('base64'),
      kind: 'conversation',
      peerIdentityId: 'identity-2',
      version: 2,
    };

    async function sendableSession(): Promise<Session> {
      return {
        deviceCredentialKeyPair: await KeyPair.generate(),
        identity: { id: 'identity-1' },
        keychain: {
          conversations: { 'conversation-1': conversationKey },
          version: 1,
        },
      } as unknown as Session;
    }

    function sendingApi(
      request: jest.Mock,
      publisher: MessageAttachmentPublisher,
      decrypt: jest.Mock,
    ): PigeonMessageCommandsApi {
      return new PigeonMessageCommandsApi(
        { request } as unknown as HttpJsonClient,
        {
          headers: jest.fn().mockResolvedValue({}),
        } as unknown as RequestSigner,
        {} as PigeonMessagesApi,
        { decrypt } as unknown as MessageProjectionPort,
        publisher,
        publicMutationSignerAt(),
      );
    }

    it('settles the uploaded attachments once the message is posted', async () => {
      const uploaded = [{ filename: 'notes.txt' }];
      const request = jest.fn().mockResolvedValue({ id: 'message-1' });
      const decrypt = jest.fn().mockResolvedValue({ id: 'message-1' });
      const publisher = {
        abandonMessageAttachments: jest.fn(),
        publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
        settleMessageAttachments: jest.fn(),
      };
      const session = await sendableSession();

      await sendingApi(request, publisher, decrypt).send(
        session,
        'conversation-1',
        'Hello',
        { attachments: [new File(['notes'], 'notes.txt')] },
      );

      expect(publisher.settleMessageAttachments).toHaveBeenCalledWith(
        session,
        uploaded,
      );
      expect(publisher.abandonMessageAttachments).not.toHaveBeenCalled();
      expect(
        publisher.settleMessageAttachments.mock.invocationCallOrder[0],
      ).toBeLessThan(decrypt.mock.invocationCallOrder[0]);
    });

    it('abandons the uploaded attachments when the node rejects the post', async () => {
      const uploaded = [{ filename: 'notes.txt' }];
      const request = jest
        .fn()
        .mockRejectedValue(new HttpJsonError(422, 'Unprocessable Entity', ''));
      const decrypt = jest.fn();
      const publisher = {
        abandonMessageAttachments: jest.fn().mockResolvedValue(undefined),
        publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
        settleMessageAttachments: jest.fn(),
      };
      const session = await sendableSession();

      await expect(
        sendingApi(request, publisher, decrypt).send(
          session,
          'conversation-1',
          'Hello',
          { attachments: [new File(['notes'], 'notes.txt')] },
        ),
      ).rejects.toThrow('422 Unprocessable Entity');

      expect(publisher.abandonMessageAttachments).toHaveBeenCalledWith(
        session,
        uploaded,
      );
      expect(publisher.settleMessageAttachments).not.toHaveBeenCalled();
      expect(decrypt).not.toHaveBeenCalled();
    });

    it('abandons the uploaded attachments when the payload cannot be serialized', async () => {
      const uploaded = [{ filename: 'notes.txt', size: BigInt(5) }];
      const request = jest.fn();
      const decrypt = jest.fn();
      const publisher = {
        abandonMessageAttachments: jest.fn().mockResolvedValue(undefined),
        publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
        settleMessageAttachments: jest.fn(),
      };
      const session = await sendableSession();

      await expect(
        sendingApi(request, publisher, decrypt).send(
          session,
          'conversation-1',
          'Hello',
          { attachments: [new File(['notes'], 'notes.txt')] },
        ),
      ).rejects.toThrow(TypeError);

      expect(request).not.toHaveBeenCalled();
      expect(publisher.abandonMessageAttachments).toHaveBeenCalledWith(
        session,
        uploaded,
      );
      expect(publisher.settleMessageAttachments).not.toHaveBeenCalled();
    });

    it.each([
      ['network error', new TypeError('Failed to fetch')],
      ['gateway timeout', new HttpJsonError(504, 'Gateway Timeout', '')],
    ])(
      'keeps the uploaded attachments when the post may have been accepted (%s)',
      async (_label, failure) => {
        const uploaded = [{ filename: 'notes.txt' }];
        const request = jest.fn().mockRejectedValue(failure);
        const decrypt = jest.fn();
        const publisher = {
          abandonMessageAttachments: jest.fn().mockResolvedValue(undefined),
          publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
          settleMessageAttachments: jest.fn(),
        };
        const session = await sendableSession();

        await expect(
          sendingApi(request, publisher, decrypt).send(
            session,
            'conversation-1',
            'Hello',
            { attachments: [new File(['notes'], 'notes.txt')] },
          ),
        ).rejects.toThrow(failure.message);

        expect(publisher.abandonMessageAttachments).not.toHaveBeenCalled();
        expect(publisher.settleMessageAttachments).not.toHaveBeenCalled();
      },
    );

    it('sends without attachments and settles an empty set', async () => {
      const request = jest.fn().mockResolvedValue({ id: 'message-1' });
      const decrypt = jest.fn().mockResolvedValue({ id: 'message-1' });
      const publisher = {
        abandonMessageAttachments: jest.fn(),
        publishMessageAttachments: jest.fn().mockResolvedValue([]),
        settleMessageAttachments: jest.fn(),
      };
      const session = await sendableSession();

      await expect(
        sendingApi(request, publisher, decrypt).send(
          session,
          'conversation-1',
          'Hello',
        ),
      ).resolves.toEqual({ id: 'message-1' });

      expect(request).toHaveBeenCalledTimes(1);
      expect(publisher.settleMessageAttachments).toHaveBeenCalledWith(
        session,
        [],
      );
      expect(publisher.abandonMessageAttachments).not.toHaveBeenCalled();
    });
  });
});
