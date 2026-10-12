import type {
  MessageAttachment,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';

import { PublishMessageAttachmentMessage } from '../../../../../contexts/attachments/application/publish-message-attachment/messages/PublishMessageAttachmentMessage';
import { Attachment } from '../../../../../contexts/attachments/domain/Attachment';
import { AttachmentPublisherExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentPublisherExternalIdentifier';
import { AttachmentPublicationContexts } from '../../../../../contexts/attachments/infrastructure/http/AttachmentPublicationContexts';
import { PigeonFilesGateway } from '../../../../../contexts/attachments/infrastructure/http/PigeonFilesGateway';

describe(PigeonFilesGateway.name, () => {
  function publishedAttachment(): Attachment {
    return Attachment.fromPrimitives({
      contentType: 'text/plain',
      externalIdentifier: 'external-1',
      filename: 'notes.txt',
      id: 'external-1',
      publication: { encrypted: false },
      size: 5,
      status: 'published',
    });
  }

  it('publishes browser files through the attachment use case', async () => {
    const contexts = new AttachmentPublicationContexts();
    const resource = {
      cid: 'external-1',
      contentType: 'text/plain',
      filename: 'notes.txt',
      size: 5,
    };
    const publish = jest
      .fn()
      .mockImplementation((message: PublishMessageAttachmentMessage) => {
        contexts.complete(message.getSourceExternalIdentifier(), resource);

        return Promise.resolve(message.getAttachment());
      });
    const gateway = new PigeonFilesGateway(
      { download: jest.fn(), findPublic: jest.fn() },
      { upload: jest.fn() },
      { publish },
      { find: jest.fn() },
      contexts,
      { plan: jest.fn().mockResolvedValue([]) },
      { abandon: jest.fn(), settle: jest.fn() },
    );
    const session = { identity: { id: 'identity-1' } } as Session;
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });

    await expect(
      gateway.publish(session, [file], undefined, {
        encryptLargeAttachments: false,
        encryptSmallAttachments: false,
      }),
    ).resolves.toEqual([resource]);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('plans origins for the recipient and falls back to the session node', async () => {
    const contexts = new AttachmentPublicationContexts();
    const resource = {
      cid: 'external-1',
      contentType: 'text/plain',
      filename: 'notes.txt',
      size: 5,
    };
    const takenOrigins: (string | undefined)[][] = [];
    const publish = jest
      .fn()
      .mockImplementation((message: PublishMessageAttachmentMessage) => {
        takenOrigins.push(
          contexts.take(
            message.getSourceExternalIdentifier(),
            AttachmentPublisherExternalIdentifier.fromString('identity-1'),
          ).origins,
        );
        contexts.complete(message.getSourceExternalIdentifier(), resource);

        return Promise.resolve(message.getAttachment());
      });
    const plan = jest
      .fn()
      .mockResolvedValueOnce(['https://node-a.example'])
      .mockResolvedValueOnce([]);
    const gateway = new PigeonFilesGateway(
      { download: jest.fn(), findPublic: jest.fn() },
      { upload: jest.fn() },
      { publish },
      { find: jest.fn() },
      contexts,
      { plan },
      { abandon: jest.fn(), settle: jest.fn() },
    );
    const session = { identity: { id: 'identity-1' } } as Session;
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    const options = {
      encryptLargeAttachments: false,
      encryptSmallAttachments: false,
      recipientIdentityId: 'identity-2',
    };

    await gateway.publish(session, [file], undefined, options);
    await gateway.publish(session, [file], undefined, {
      encryptLargeAttachments: false,
      encryptSmallAttachments: false,
    });

    expect(plan).toHaveBeenNthCalledWith(1, 'identity-2');
    expect(plan).toHaveBeenNthCalledWith(2, undefined);
    expect(takenOrigins).toEqual([['https://node-a.example'], [undefined]]);
  });

  it('abandons the replicas of published files when a later file fails', async () => {
    const contexts = new AttachmentPublicationContexts();
    const uploaded = {
      blobs: [
        {
          blobId: 'blob-1',
          downloadToken: 'download-token-1',
          expiresAt: 1,
          index: 0,
          origin: 'https://node-a.example',
          size: 3,
        },
      ],
      contentType: 'text/plain',
      filename: 'one.txt',
      size: 3,
    };
    const publish = jest
      .fn()
      .mockImplementationOnce((message: PublishMessageAttachmentMessage) => {
        contexts.complete(message.getSourceExternalIdentifier(), uploaded);

        return Promise.resolve(message.getAttachment());
      })
      .mockRejectedValueOnce(new Error('upload failed'));
    const replicator = {
      abandon: jest.fn().mockResolvedValue(undefined),
      settle: jest.fn(),
    };
    const gateway = new PigeonFilesGateway(
      { download: jest.fn(), findPublic: jest.fn() },
      { upload: jest.fn() },
      { publish },
      { find: jest.fn() },
      contexts,
      { plan: jest.fn().mockResolvedValue(['https://node-a.example']) },
      replicator,
    );
    const session = { identity: { id: 'identity-1' } } as Session;
    const files = [
      new File(['one'], 'one.txt', { type: 'text/plain' }),
      new File(['two'], 'two.txt', { type: 'text/plain' }),
    ];

    await expect(
      gateway.publish(session, files, undefined, {
        encryptLargeAttachments: false,
        encryptSmallAttachments: false,
      }),
    ).rejects.toThrow('upload failed');
    expect(replicator.abandon).toHaveBeenCalledWith(session, [
      { blobId: 'blob-1', origin: 'https://node-a.example' },
    ]);
  });

  it('routes settle and abandon for message attachments to the replicator', async () => {
    const replicator = {
      abandon: jest.fn().mockResolvedValue(undefined),
      settle: jest.fn(),
    };
    const gateway = new PigeonFilesGateway(
      { download: jest.fn(), findPublic: jest.fn() },
      { upload: jest.fn() },
      { publish: jest.fn() },
      { find: jest.fn() },
      new AttachmentPublicationContexts(),
      { plan: jest.fn() },
      replicator,
    );
    const session = { identity: { id: 'identity-1' } } as Session;
    const attachments: MessageAttachment[] = [
      {
        blobs: [
          {
            blobId: 'blob-1',
            downloadToken: 'download-token-1',
            expiresAt: 1,
            index: 0,
            origin: 'https://node-a.example',
            size: 3,
          },
        ],
        contentType: 'text/plain',
        filename: 'one.txt',
        size: 3,
      },
    ];
    const refs = [{ blobId: 'blob-1', origin: 'https://node-a.example' }];

    gateway.settleMessageAttachments(session, attachments);
    await gateway.abandonMessageAttachments(session, attachments);

    expect(replicator.settle).toHaveBeenCalledWith(session, refs);
    expect(replicator.abandon).toHaveBeenCalledWith(session, refs);
  });

  it('delegates download and public file operations', async () => {
    const blob = new Blob(['content']);
    const publicContent = { blob };
    const downloader = {
      download: jest.fn().mockResolvedValue(blob),
      findPublic: jest.fn().mockResolvedValue(publicContent),
    };
    const find = jest.fn().mockResolvedValueOnce(publishedAttachment());
    const gateway = new PigeonFilesGateway(
      downloader,
      { upload: jest.fn() },
      { publish: jest.fn() },
      { find },
      new AttachmentPublicationContexts(),
      { plan: jest.fn() },
      { abandon: jest.fn(), settle: jest.fn() },
    );

    await expect(
      gateway.download({
        cid: 'external-1',
        contentType: 'text/plain',
        filename: 'notes.txt',
        size: 5,
      }),
    ).resolves.toBe(blob);
    await expect(gateway.getPublicFile('public-1')).resolves.toBe(
      publicContent,
    );
    expect(find).toHaveBeenCalledTimes(1);
    expect(downloader.findPublic).toHaveBeenCalledWith('external-1');
  });
});
