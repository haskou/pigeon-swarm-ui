import type { MessageAttachment } from '../../../../../shared/domain/pigeonResources.types';

import { PrivateBlobUnavailableError } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobUnavailableError';
import { loadOriginalImage } from '../../../../../contexts/messages/presentation/components/loadOriginalImage';

const attachment: MessageAttachment = {
  cid: 'cid',
  contentType: 'image/png',
  filename: 'photo.png',
  size: 2048,
};

describe(loadOriginalImage.name, () => {
  it('returns the loaded full-size URL', async () => {
    const loadImage = jest.fn().mockResolvedValue('blob:full');

    await expect(loadOriginalImage(attachment, loadImage)).resolves.toEqual({
      status: 'loaded',
      url: 'blob:full',
    });
    expect(loadImage).toHaveBeenCalledWith(attachment);
  });

  it('reports a missing private blob as a failed full-size load', async () => {
    const loadImage = jest
      .fn()
      .mockRejectedValue(new PrivateBlobUnavailableError());

    await expect(loadOriginalImage(attachment, loadImage)).resolves.toEqual({
      status: 'failed',
    });
  });

  it('reports any other download or decryption failure as failed', async () => {
    const loadImage = jest
      .fn()
      .mockRejectedValue(new TypeError('fetch failed'));

    await expect(loadOriginalImage(attachment, loadImage)).resolves.toEqual({
      status: 'failed',
    });
  });
});
