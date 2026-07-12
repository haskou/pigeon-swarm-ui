import type { AnimatedWebpEncoder } from '../../../../../shared/presentation/media/AnimatedWebpEncoder';

import { MessageAttachmentThumbnailPreparer } from '../../../../../contexts/attachments/infrastructure/media/MessageAttachmentThumbnailPreparer';

describe(MessageAttachmentThumbnailPreparer.name, () => {
  const originalImage = globalThis.Image;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    class TestImage {
      public naturalHeight = 480;
      public naturalWidth = 960;
      public height = 480;
      public width = 960;
      public onerror: (() => void) | null = null;
      public onload: (() => void) | null = null;

      public set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    globalThis.Image = TestImage as unknown as typeof Image;
    URL.createObjectURL = jest.fn().mockReturnValue('blob:test-image');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    jest.restoreAllMocks();
  });

  it('creates animated webp thumbnails for animated gif attachments', async () => {
    const encoded = new Blob(['animated-webp'], { type: 'image/webp' });
    const gifEncoder = {
      encodeGif: jest.fn().mockResolvedValue(encoded),
      isAnimatedGif: jest.fn().mockResolvedValue(true),
    } as unknown as AnimatedWebpEncoder;
    const source = new File([new Uint8Array(256 * 1024)], 'party.gif', {
      lastModified: 1234,
      type: 'image/gif',
    });

    const result = await new MessageAttachmentThumbnailPreparer(
      gifEncoder,
    ).prepare(source);

    expect(gifEncoder.isAnimatedGif).toHaveBeenCalledWith(source);
    expect(gifEncoder.encodeGif).toHaveBeenCalledWith(
      source,
      expect.objectContaining({
        drawFrame: expect.any(Function),
        outputHeight: 240,
        outputWidth: 480,
        quality: 0.72,
      }),
    );
    expect(result?.name).toBe('party.thumbnail.webp');
    expect(result?.type).toBe('image/webp');
    expect(result?.lastModified).toBe(1234);
    await expect(result?.text()).resolves.toBe('animated-webp');
  });

  it('does not fall back to a static thumbnail when the animated thumbnail is not smaller', async () => {
    const encoded = new Blob([new Uint8Array(300 * 1024)], {
      type: 'image/webp',
    });
    const gifEncoder = {
      encodeGif: jest.fn().mockResolvedValue(encoded),
      isAnimatedGif: jest.fn().mockResolvedValue(true),
    } as unknown as AnimatedWebpEncoder;
    const source = new File([new Uint8Array(256 * 1024)], 'party.gif', {
      type: 'image/gif',
    });

    await expect(
      new MessageAttachmentThumbnailPreparer(gifEncoder).prepare(source),
    ).resolves.toBeNull();
    expect(gifEncoder.encodeGif).toHaveBeenCalledTimes(1);
  });
});
