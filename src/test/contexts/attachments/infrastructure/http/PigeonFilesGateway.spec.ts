import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PublishMessageAttachmentMessage } from '../../../../../contexts/attachments/application/publish-message-attachment/messages/PublishMessageAttachmentMessage';
import { Attachment } from '../../../../../contexts/attachments/domain/Attachment';
import { EncryptedAttachmentStrategy } from '../../../../../contexts/attachments/domain/strategies/EncryptedAttachmentStrategy';
import { PublicAttachmentStrategy } from '../../../../../contexts/attachments/domain/strategies/PublicAttachmentStrategy';
import { AttachmentByteSize } from '../../../../../contexts/attachments/domain/value-objects/AttachmentByteSize';
import { AttachmentContentType } from '../../../../../contexts/attachments/domain/value-objects/AttachmentContentType';
import { AttachmentExternalIdentifier } from '../../../../../contexts/attachments/domain/value-objects/AttachmentExternalIdentifier';
import { AttachmentFilename } from '../../../../../contexts/attachments/domain/value-objects/AttachmentFilename';
import { AttachmentId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentId';
import { AttachmentNetworkId } from '../../../../../contexts/attachments/domain/value-objects/AttachmentNetworkId';
import { AttachmentPublicationContexts } from '../../../../../contexts/attachments/infrastructure/http/AttachmentPublicationContexts';
import { PigeonFilesGateway } from '../../../../../contexts/attachments/infrastructure/http/PigeonFilesGateway';

describe(PigeonFilesGateway.name, () => {
  function publishedAttachment(encrypted: boolean): Attachment {
    return Attachment.restorePublished(
      AttachmentId.fromString('external-1'),
      AttachmentFilename.fromString('notes.txt'),
      AttachmentContentType.fromString('text/plain'),
      AttachmentByteSize.fromBytes(5),
      encrypted
        ? EncryptedAttachmentStrategy.forNetwork(
            AttachmentNetworkId.fromString('network-1'),
          )
        : PublicAttachmentStrategy.create(),
      AttachmentExternalIdentifier.fromString('external-1'),
    );
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
      {
        download: jest.fn(),
        findPrivate: jest.fn(),
        findPublic: jest.fn(),
      },
      { upload: jest.fn() },
      { upload: jest.fn() },
      { publish },
      { find: jest.fn() },
      contexts,
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

  it('delegates public, private, and download compatibility operations', async () => {
    const blob = new Blob(['content']);
    const privateContent = { encryptedData: 'AQID' };
    const publicContent = { blob };
    const downloader = {
      download: jest.fn().mockResolvedValue(blob),
      findPrivate: jest.fn().mockResolvedValue(privateContent),
      findPublic: jest.fn().mockResolvedValue(publicContent),
    };
    const find = jest
      .fn()
      .mockResolvedValueOnce(publishedAttachment(true))
      .mockResolvedValueOnce(publishedAttachment(false));
    const gateway = new PigeonFilesGateway(
      downloader,
      { upload: jest.fn() },
      { upload: jest.fn() },
      { publish: jest.fn() },
      { find },
      new AttachmentPublicationContexts(),
    );

    await expect(
      gateway.downloadAttachment({
        cid: 'external-1',
        contentType: 'text/plain',
        filename: 'notes.txt',
        size: 5,
      }),
    ).resolves.toBe(blob);
    await expect(gateway.getPrivateFile('private-1')).resolves.toBe(
      privateContent,
    );
    await expect(gateway.getPublicFile('public-1')).resolves.toBe(
      publicContent,
    );
    expect(find).toHaveBeenCalledTimes(2);
    expect(downloader.findPrivate).toHaveBeenCalledWith('external-1');
    expect(downloader.findPublic).toHaveBeenCalledWith('external-1');
  });
});
