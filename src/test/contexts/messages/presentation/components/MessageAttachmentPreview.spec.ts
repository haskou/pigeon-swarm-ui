import type { MessageAttachment } from '../../../../../shared/domain/pigeonResources.types';

import { MessageAttachmentPreview } from '../../../../../contexts/messages/presentation/components/MessageAttachmentPreview';

const attachment = (
  overrides: Partial<MessageAttachment> = {},
): MessageAttachment => ({
  cid: 'cid',
  contentType: 'image/png',
  filename: 'image.png',
  size: 1024,
  ...overrides,
});

describe(MessageAttachmentPreview.name, () => {
  it('allows small browser-previewable images', () => {
    expect(MessageAttachmentPreview.isImage(attachment())).toBe(true);
    expect(
      MessageAttachmentPreview.isImage(
        attachment({ contentType: 'image/webp' }),
      ),
    ).toBe(true);
  });

  it('rejects large static image previews', () => {
    expect(
      MessageAttachmentPreview.isImage(attachment({ size: 6 * 1024 * 1024 })),
    ).toBe(false);
  });

  it('allows large images when a lightweight preview attachment exists', () => {
    expect(
      MessageAttachmentPreview.isImage(
        attachment({
          preview: attachment({
            cid: 'preview-cid',
            filename: 'preview.webp',
            size: 32 * 1024,
          }),
          size: 6 * 1024 * 1024,
        }),
      ),
    ).toBe(true);
  });

  it('allows large local pending images because they do not need downloading', () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024)], 'large.png', {
      type: 'image/png',
    });

    expect(
      MessageAttachmentPreview.isImage(
        attachment({
          localFile: file,
          size: file.size,
          type: 'chunked_file',
        }),
      ),
    ).toBe(true);
  });

  it('allows local pending images when the browser omits their mime type', () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024)], 'large.webp');

    expect(
      MessageAttachmentPreview.isImage(
        attachment({
          localFile: file,
          size: file.size,
          type: 'chunked_file',
        }),
      ),
    ).toBe(true);
  });

  it('rejects animated images above the smaller preview budget', () => {
    expect(
      MessageAttachmentPreview.isImage(
        attachment({ contentType: 'image/gif', size: 3 * 1024 * 1024 }),
      ),
    ).toBe(false);
    expect(
      MessageAttachmentPreview.isImage(
        attachment({ contentType: 'image/gif', size: 512 * 1024 }),
      ),
    ).toBe(true);
  });

  it('rejects chunked and non-image attachments', () => {
    expect(
      MessageAttachmentPreview.isImage(
        attachment({
          chunks: [{ cid: 'part', index: 0, sha256: 'hash', size: 1024 }],
        }),
      ),
    ).toBe(false);
    expect(
      MessageAttachmentPreview.isImage(
        attachment({ contentType: 'application/pdf' }),
      ),
    ).toBe(false);
  });
});
