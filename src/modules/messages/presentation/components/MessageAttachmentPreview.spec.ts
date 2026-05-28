import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

import { MessageAttachmentPreview } from './MessageAttachmentPreview';

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
      MessageAttachmentPreview.isImage(
        attachment({ size: 6 * 1024 * 1024 }),
      ),
    ).toBe(false);
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
