import type { MessageAttachment } from '../../../../../shared/domain/pigeonResources.types';

import { attachmentIdentity } from '../../../../../contexts/messages/presentation/view-models/attachmentIdentity';

function blobAttachment(
  blobId: string,
  overrides: Partial<MessageAttachment> = {},
): MessageAttachment {
  return {
    blobs: [{ blobId, index: 0, size: 1024 }],
    contentType: 'image/webp',
    filename: 'photo.webp',
    size: 1024,
    ...overrides,
  } as MessageAttachment;
}

describe(attachmentIdentity.name, () => {
  it('uses the public CID for public attachments', () => {
    expect(
      attachmentIdentity({
        cid: 'bafy-public',
        contentType: 'image/webp',
        filename: 'photo.webp',
        size: 1024,
      }),
    ).toBe('bafy-public');
  });

  it('uses the first private blob id when there is no CID', () => {
    expect(attachmentIdentity(blobAttachment('blob-a'))).toBe('blob-a');
  });

  it('keeps two blob-only attachments with identical metadata distinct', () => {
    expect(attachmentIdentity(blobAttachment('blob-a'))).not.toBe(
      attachmentIdentity(blobAttachment('blob-b')),
    );
  });
});
