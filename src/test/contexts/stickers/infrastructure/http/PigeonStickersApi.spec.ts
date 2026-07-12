import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonPublicFilesClient } from '../../../../../contexts/attachments/infrastructure/http/PigeonPublicFilesClient';
import { PigeonStickersApi } from '../../../../../contexts/stickers/infrastructure/http/PigeonStickersApi';

describe(PigeonStickersApi.name, () => {
  it('converts sticker images before uploading the public asset', async () => {
    const session = { identity: { id: 'identity-1' } } as Session;
    const sourceFile = new File(['png'], 'smile.png', { type: 'image/png' });
    const webpFile = new File(['webp'], 'smile.webp', { type: 'image/webp' });
    const publicFiles = {
      upload: jest.fn().mockResolvedValue({
        cid: 'sticker-cid',
        contentType: 'image/webp',
        filename: 'smile.webp',
        size: webpFile.size,
      }),
    } as unknown as PigeonPublicFilesClient;
    const publicImageUploadPreparer = {
      prepare: jest.fn().mockResolvedValue(webpFile),
    };
    const api = new PigeonStickersApi(
      {} as HttpJsonClient,
      {} as RequestSigner,
      publicFiles,
      publicImageUploadPreparer,
    );

    await expect(api.uploadAsset(session, sourceFile)).resolves.toEqual({
      cid: 'sticker-cid',
      contentType: 'image/webp',
      filename: 'smile.webp',
      size: webpFile.size,
    });

    expect(publicImageUploadPreparer.prepare).toHaveBeenCalledWith(sourceFile);
    expect(publicFiles.upload).toHaveBeenCalledWith(
      session,
      expect.any(ArrayBuffer),
      'smile.webp',
      'image/webp',
    );
  });
});
