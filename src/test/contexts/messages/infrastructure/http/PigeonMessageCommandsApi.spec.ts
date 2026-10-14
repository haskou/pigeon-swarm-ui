import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { MessageAttachmentPublisher } from '../../../../../contexts/messages/infrastructure/http/MessageAttachmentPublisher';
import type { PigeonLinkPreviewsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonLinkPreviewsApi';
import type { PublicMutationSigner } from '../../../../../shared/infrastructure/crypto/PublicMutationSigner';

import { ConversationKeyRequiredError } from '../../../../../contexts/messages/domain/errors/ConversationKeyRequiredError';
import { PigeonMessageCommandsApi } from '../../../../../contexts/messages/infrastructure/http/PigeonMessageCommandsApi';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

describe(PigeonMessageCommandsApi.name, () => {
  const session = {
    identity: { id: 'identity-1' },
    keychain: { conversations: {}, version: 1 },
  } as unknown as Session;

  const commandApi = () =>
    new PigeonMessageCommandsApi(
      {} as PigeonLinkPreviewsApi,
      {} as MessageAttachmentPublisher,
      {} as PublicMutationSigner,
    );

  it('rejects a sent record when the conversation key is unavailable', async () => {
    const deliver = jest.fn();

    await expect(
      commandApi().withSentRecord(
        session,
        'conversation-1',
        'Hello',
        {},
        deliver,
      ),
    ).rejects.toBeInstanceOf(ConversationKeyRequiredError);
    expect(deliver).not.toHaveBeenCalled();
  });

  it('rejects an edit when the conversation key is unavailable', async () => {
    await expect(
      commandApi().composeEdit(
        session,
        'conversation-1',
        'message-1',
        'Updated',
      ),
    ).rejects.toBeInstanceOf(ConversationKeyRequiredError);
  });

  describe('delivering with attachments', () => {
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
      publisher: MessageAttachmentPublisher,
    ): PigeonMessageCommandsApi {
      return new PigeonMessageCommandsApi(
        {} as PigeonLinkPreviewsApi,
        publisher,
        publicMutationSignerAt(),
      );
    }

    it('settles the uploaded attachments once the record is delivered', async () => {
      const uploaded = [{ filename: 'notes.txt' }];
      const deliver = jest.fn().mockResolvedValue('delivered');
      const publisher = {
        abandonMessageAttachments: jest.fn(),
        publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
        settleMessageAttachments: jest.fn(),
      };
      const session = await sendableSession();

      await expect(
        sendingApi(publisher).withSentRecord(
          session,
          'conversation-1',
          'Hello',
          { attachments: [new File(['notes'], 'notes.txt')] },
          deliver,
        ),
      ).resolves.toBe('delivered');

      expect(deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conversation-1',
          type: 'sent',
        }),
      );
      expect(publisher.settleMessageAttachments).toHaveBeenCalledWith(
        session,
        uploaded,
      );
      expect(publisher.abandonMessageAttachments).not.toHaveBeenCalled();
    });

    it('abandons the uploaded attachments when the node rejects the delivery', async () => {
      const uploaded = [{ filename: 'notes.txt' }];
      const deliver = jest
        .fn()
        .mockRejectedValue(new HttpJsonError(422, 'Unprocessable Entity', ''));
      const publisher = {
        abandonMessageAttachments: jest.fn().mockResolvedValue(undefined),
        publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
        settleMessageAttachments: jest.fn(),
      };
      const session = await sendableSession();

      await expect(
        sendingApi(publisher).withSentRecord(
          session,
          'conversation-1',
          'Hello',
          { attachments: [new File(['notes'], 'notes.txt')] },
          deliver,
        ),
      ).rejects.toThrow('422 Unprocessable Entity');

      expect(publisher.abandonMessageAttachments).toHaveBeenCalledWith(
        session,
        uploaded,
      );
      expect(publisher.settleMessageAttachments).not.toHaveBeenCalled();
    });

    it('abandons the uploaded attachments when the payload cannot be serialized', async () => {
      const uploaded = [{ filename: 'notes.txt', size: BigInt(5) }];
      const deliver = jest.fn();
      const publisher = {
        abandonMessageAttachments: jest.fn().mockResolvedValue(undefined),
        publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
        settleMessageAttachments: jest.fn(),
      };
      const session = await sendableSession();

      await expect(
        sendingApi(publisher).withSentRecord(
          session,
          'conversation-1',
          'Hello',
          { attachments: [new File(['notes'], 'notes.txt')] },
          deliver,
        ),
      ).rejects.toThrow(TypeError);

      expect(deliver).not.toHaveBeenCalled();
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
      'keeps the uploaded attachments when the delivery may have been accepted (%s)',
      async (_label, failure) => {
        const uploaded = [{ filename: 'notes.txt' }];
        const deliver = jest.fn().mockRejectedValue(failure);
        const publisher = {
          abandonMessageAttachments: jest.fn().mockResolvedValue(undefined),
          publishMessageAttachments: jest.fn().mockResolvedValue(uploaded),
          settleMessageAttachments: jest.fn(),
        };
        const session = await sendableSession();

        await expect(
          sendingApi(publisher).withSentRecord(
            session,
            'conversation-1',
            'Hello',
            { attachments: [new File(['notes'], 'notes.txt')] },
            deliver,
          ),
        ).rejects.toThrow(failure.message);

        expect(publisher.abandonMessageAttachments).not.toHaveBeenCalled();
        expect(publisher.settleMessageAttachments).not.toHaveBeenCalled();
      },
    );
  });
});
