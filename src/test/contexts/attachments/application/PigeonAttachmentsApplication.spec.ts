import type {
  MessageAttachment,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { PigeonAttachmentsApplication } from '../../../../contexts/attachments/application/PigeonAttachmentsApplication';

describe(PigeonAttachmentsApplication.name, () => {
  type Dependencies = ConstructorParameters<
    typeof PigeonAttachmentsApplication
  >[0];

  function gatewayDouble(): jest.Mocked<Dependencies> {
    return {
      downloadAttachment: { downloadAttachment: jest.fn() },
      getPublicFile: { getPublicFile: jest.fn() },
      publishMessageAttachments: { publish: jest.fn() },
      uploadPublicFile: { uploadPublicFile: jest.fn() },
    } as unknown as jest.Mocked<Dependencies>;
  }

  const session = {
    identity: { id: 'identity-1' },
  } as unknown as Session;

  it('publishes attachment files through the application message', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonAttachmentsApplication(gateway);
    const file = new File(['payload'], 'document.txt', { type: 'text/plain' });
    const published = [{ cid: 'attachment-cid' }] as MessageAttachment[];
    (gateway.publishMessageAttachments.publish as jest.Mock).mockResolvedValue(
      published,
    );

    await expect(
      application.publish(session, [file], undefined, {
        encryptSmallAttachments: true,
      }),
    ).resolves.toBe(published);
    expect(gateway.publishMessageAttachments.publish).toHaveBeenCalled();
  });

  it('keeps attachment downloads independent from the active session', async () => {
    const gateway = gatewayDouble();
    const application = new PigeonAttachmentsApplication(gateway);
    const attachment = { cid: 'attachment-cid' } as MessageAttachment;
    const content = new Blob(['payload']);
    (
      gateway.downloadAttachment.downloadAttachment as jest.Mock
    ).mockResolvedValue(content);

    await expect(application.download(attachment)).resolves.toBe(content);
    expect(gateway.downloadAttachment.downloadAttachment).toHaveBeenCalledWith(
      attachment,
      undefined,
    );
  });
});
