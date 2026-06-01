import type { MessageAttachment } from '../../../shared/domain/pigeonResources.types';

import { AttachmentExternalIdentifiers } from './AttachmentExternalIdentifiers';

describe(AttachmentExternalIdentifiers.name, () => {
  it('includes preview attachment identifiers alongside originals', () => {
    const attachments: MessageAttachment[] = [
      {
        cid: 'original-cid',
        contentType: 'image/webp',
        filename: 'image.webp',
        preview: {
          cid: 'preview-cid',
          contentType: 'image/webp',
          filename: 'image.preview.webp',
          size: 24,
        },
        size: 1024,
      },
      {
        cid: 'document-cid',
        contentType: 'application/pdf',
        filename: 'document.pdf',
        size: 2048,
      },
    ];

    expect(AttachmentExternalIdentifiers.from(attachments)).toEqual([
      'original-cid',
      'preview-cid',
      'document-cid',
    ]);
  });
});
