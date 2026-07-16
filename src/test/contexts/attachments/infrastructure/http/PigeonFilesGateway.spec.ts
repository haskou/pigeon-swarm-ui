import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PublishMessageAttachmentMessage } from '../../../../../contexts/attachments/application/publish-message-attachment/messages/PublishMessageAttachmentMessage';
import { AttachmentPublicationContexts } from '../../../../../contexts/attachments/infrastructure/http/AttachmentPublicationContexts';
import { PigeonFilesGateway } from '../../../../../contexts/attachments/infrastructure/http/PigeonFilesGateway';

describe(PigeonFilesGateway.name, () => {
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
    const gateway = new PigeonFilesGateway(
      downloader,
      { upload: jest.fn() },
      { upload: jest.fn() },
      { publish: jest.fn() },
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
  });
});
