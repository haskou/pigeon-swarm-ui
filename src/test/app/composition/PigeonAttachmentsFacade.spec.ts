import type { PigeonFilesGateway } from '../../../contexts/attachments/infrastructure/http/PigeonFilesGateway';
import type { Session } from '../../../contexts/identities/domain/Session';

import { PigeonAttachmentsFacade } from '../../../app/composition/PigeonAttachmentsFacade';

describe(PigeonAttachmentsFacade.name, () => {
  let files: jest.Mocked<
    Pick<
      PigeonFilesGateway,
      'download' | 'getPublicFile' | 'publish' | 'uploadPublic'
    >
  >;
  let attachments: PigeonAttachmentsFacade;

  beforeEach(() => {
    files = {
      download: jest.fn(),
      getPublicFile: jest.fn(),
      publish: jest.fn(),
      uploadPublic: jest.fn(),
    };
    attachments = new PigeonAttachmentsFacade(files);
  });

  it('downloads message attachments through the files gateway', async () => {
    const attachment = {
      cid: 'attachment-cid',
      contentType: 'image/webp',
      filename: 'picture.webp',
      size: 42,
    };
    const blob = new Blob();

    files.download.mockResolvedValue(blob);

    await expect(attachments.download(attachment)).resolves.toBe(blob);
    expect(files.download).toHaveBeenCalledWith(attachment, undefined);
  });

  it('finds public attachment content through the files gateway', async () => {
    const content = {
      blob: new Blob(),
      cid: 'attachment-cid',
      contentType: 'image/webp',
      filename: 'picture.webp',
      size: 42,
    };

    files.getPublicFile.mockResolvedValue(content);

    await expect(attachments.getPublicFile('attachment-cid')).resolves.toBe(
      content,
    );
  });

  it('publishes message attachments through the files gateway', async () => {
    const session = {} as Session;
    const file = new File(['contents'], 'picture.webp');
    const published = [
      {
        cid: 'attachment-cid',
        contentType: 'image/webp',
        filename: 'picture.webp',
        size: 42,
      },
    ];

    files.publish.mockResolvedValue(published);

    await expect(attachments.publish(session, [file])).resolves.toBe(published);
    expect(files.publish).toHaveBeenCalledWith(
      session,
      [file],
      undefined,
      undefined,
    );
  });

  it('uploads public files through the files gateway', async () => {
    const session = {} as Session;
    const file = new File(['contents'], 'picture.webp');
    const uploaded = {
      cid: 'attachment-cid',
      contentType: 'image/webp',
      filename: 'picture.webp',
      size: 42,
    };

    files.uploadPublic.mockResolvedValue(uploaded);

    await expect(attachments.uploadPublic(session, file)).resolves.toBe(
      uploaded,
    );
    expect(files.uploadPublic).toHaveBeenCalledWith(session, file);
  });
});
