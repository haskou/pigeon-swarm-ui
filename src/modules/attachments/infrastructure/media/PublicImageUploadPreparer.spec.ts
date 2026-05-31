import { PublicImageUploadPreparer } from './PublicImageUploadPreparer';

describe(PublicImageUploadPreparer.name, () => {
  it('keeps non-raster or already webp files unchanged', async () => {
    const encodeImage = jest.fn();
    const preparer = new PublicImageUploadPreparer(encodeImage);
    const files = [
      new File(['hello'], 'readme.txt', { type: 'text/plain' }),
      new File(['webp'], 'avatar.webp', { type: 'image/webp' }),
      new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }),
    ];

    await expect(
      Promise.all(files.map((file) => preparer.prepare(file))),
    ).resolves.toEqual(files);
    expect(encodeImage).not.toHaveBeenCalled();
  });

  it('converts supported raster images to webp files', async () => {
    const encoded = new Blob(['webp-bytes'], { type: 'image/webp' });
    const source = new File(['png-bytes'], 'avatar.png', {
      lastModified: 1234,
      type: 'image/png',
    });
    const encodeImage = jest.fn().mockResolvedValue(encoded);
    const preparer = new PublicImageUploadPreparer(encodeImage);

    const result = await preparer.prepare(source);

    expect(encodeImage).toHaveBeenCalledWith(source);
    expect(result.name).toBe('avatar.webp');
    expect(result.type).toBe('image/webp');
    expect(result.lastModified).toBe(1234);
    await expect(result.text()).resolves.toBe('webp-bytes');
  });

  it('detects common raster images by filename when the file has no type', async () => {
    const encoded = new Blob(['webp-bytes'], { type: 'image/webp' });
    const source = new File(['jpeg-bytes'], 'banner.JPEG');
    const encodeImage = jest.fn().mockResolvedValue(encoded);
    const preparer = new PublicImageUploadPreparer(encodeImage);

    const result = await preparer.prepare(source);

    expect(encodeImage).toHaveBeenCalledWith(source);
    expect(result.name).toBe('banner.webp');
    expect(result.type).toBe('image/webp');
  });

  it('converts gifs to webp files through the gif encoder', async () => {
    const encoded = new Blob(['animated-webp-bytes'], { type: 'image/webp' });
    const source = new File(['gif-bytes'], 'sticker.gif', {
      lastModified: 4321,
      type: 'image/gif',
    });
    const encodeImage = jest.fn();
    const encodeGif = jest.fn().mockResolvedValue(encoded);
    const preparer = new PublicImageUploadPreparer(encodeImage, encodeGif);

    const result = await preparer.prepare(source);

    expect(encodeImage).not.toHaveBeenCalled();
    expect(encodeGif).toHaveBeenCalledWith(source);
    expect(result.name).toBe('sticker.webp');
    expect(result.type).toBe('image/webp');
    expect(result.lastModified).toBe(4321);
    await expect(result.text()).resolves.toBe('animated-webp-bytes');
  });
});
