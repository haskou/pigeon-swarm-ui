import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';
import { PigeonPublicFileUploader } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFileUploader';
import { PublicImageUploadPreparer } from '../../../../../contexts/attachments/infrastructure/media/PublicImageUploadPreparer';

describe(PigeonPublicFileUploader.name, () => {
  it('prepares and uploads public files', async () => {
    const source = new File(['png'], 'avatar.png', { type: 'image/png' });
    const prepared = new File(['webp'], 'avatar.webp', { type: 'image/webp' });
    const session = { identity: { id: 'identity-1' } } as Session;
    const files = {
      upload: jest.fn().mockResolvedValue({
        cid: 'external-1',
        contentType: 'image/webp',
        filename: 'avatar.webp',
        size: prepared.size,
      }),
    } as unknown as PigeonPublicFilesClient;
    const images = {
      prepare: jest.fn().mockResolvedValue(prepared),
    } as unknown as PublicImageUploadPreparer;
    const uploader = new PigeonPublicFileUploader(files, images);

    await expect(uploader.upload(session, source)).resolves.toEqual(
      expect.objectContaining({ cid: 'external-1' }),
    );
    expect(images.prepare).toHaveBeenCalledWith(source);
    expect(files.upload).toHaveBeenCalledWith(
      session,
      expect.any(ArrayBuffer),
      'avatar.webp',
      'image/webp',
    );
  });
});
