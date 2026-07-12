import { isBrowserPreviewFile } from '../../../shared/presentation/isBrowserPreviewFile';

describe(isBrowserPreviewFile.name, () => {
  it('detects previewable images by mime type', () => {
    expect(
      isBrowserPreviewFile(
        new File(['image'], 'upload.bin', { type: 'image/png' }),
      ),
    ).toBe(true);
  });

  it('detects previewable images by extension when browsers omit the mime type', () => {
    expect(
      isBrowserPreviewFile(new File(['image'], 'ChatGPT Image May 31.webp')),
    ).toBe(true);
  });

  it('rejects non-image files', () => {
    expect(isBrowserPreviewFile(new File(['pdf'], 'report.pdf'))).toBe(false);
  });
});
