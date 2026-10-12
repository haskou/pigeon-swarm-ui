import type { MessageAttachment } from '../../../../../contexts/attachments/application/contracts/MessageAttachment';
import type { StoredPrivateBlobReplica } from '../../../../../contexts/attachments/infrastructure/http/PrivateBlobReplicator';

import {
  privateBlobRefsOf,
  toPrivateBlobReference,
} from '../../../../../contexts/attachments/infrastructure/http/privateBlobReference';

const replica = (
  blobId: string,
  origin?: string,
): StoredPrivateBlobReplica => ({
  blobId,
  downloadToken: `${blobId}-download`,
  expiresAt: 10,
  ...(origin === undefined ? {} : { origin }),
  uploadToken: `${blobId}-upload`,
});

describe('toPrivateBlobReference', () => {
  it('maps the first replica to the primary with its origin', () => {
    const reference = toPrivateBlobReference(2, 10, [
      replica('blob-1', 'https://node-a.example'),
    ]);

    expect(reference).toEqual({
      blobId: 'blob-1',
      downloadToken: 'blob-1-download',
      expiresAt: 10,
      index: 2,
      origin: 'https://node-a.example',
      size: 10,
    });
    expect(reference).not.toHaveProperty('alternates');
  });

  it('omits origin when the primary is on the session node', () => {
    const reference = toPrivateBlobReference(0, 4, [
      replica('blob-1'),
      replica('blob-2', 'https://node-b.example'),
    ]);

    expect(reference).not.toHaveProperty('origin');
    expect(reference.alternates).toEqual([
      {
        blobId: 'blob-2',
        downloadToken: 'blob-2-download',
        origin: 'https://node-b.example',
      },
    ]);
  });

  it('keeps at most two alternates with an origin, in replica order', () => {
    const reference = toPrivateBlobReference(0, 4, [
      replica('blob-1', 'https://node-a.example'),
      replica('blob-2', 'https://node-b.example'),
      replica('blob-3'),
      replica('blob-4', 'https://node-c.example'),
      replica('blob-5', 'https://node-d.example'),
    ]);

    expect(reference.alternates).toEqual([
      {
        blobId: 'blob-2',
        downloadToken: 'blob-2-download',
        origin: 'https://node-b.example',
      },
      {
        blobId: 'blob-4',
        downloadToken: 'blob-4-download',
        origin: 'https://node-c.example',
      },
    ]);
  });

  it('omits alternates when no other replica has an origin', () => {
    const reference = toPrivateBlobReference(0, 4, [
      replica('blob-1', 'https://node-a.example'),
      replica('blob-2'),
    ]);

    expect(reference).not.toHaveProperty('alternates');
  });
});

describe('privateBlobRefsOf', () => {
  const reference = (
    blobId: string,
    origin?: string,
    alternates?: { blobId: string; downloadToken: string; origin: string }[],
  ) => ({
    blobId,
    downloadToken: `${blobId}-download`,
    expiresAt: 10,
    index: 0,
    size: 4,
    ...(origin === undefined ? {} : { origin }),
    ...(alternates === undefined ? {} : { alternates }),
  });

  it('flattens primary blobs and alternates of every attachment', () => {
    const attachments = [
      {
        blobs: [
          reference('primary-1', 'https://node-a.example', [
            {
              blobId: 'alternate-1',
              downloadToken: 'alternate-1-download',
              origin: 'https://node-b.example',
            },
          ]),
        ],
      },
      { blobs: [reference('primary-2')] },
    ] as MessageAttachment[];

    expect(privateBlobRefsOf(attachments)).toEqual([
      { blobId: 'primary-1', origin: 'https://node-a.example' },
      { blobId: 'alternate-1', origin: 'https://node-b.example' },
      { blobId: 'primary-2' },
    ]);
  });

  it('includes the replicas of an attachment preview', () => {
    const attachments = [
      {
        blobs: [reference('file-1')],
        preview: { blobs: [reference('preview-1', 'https://node-a.example')] },
      },
    ] as MessageAttachment[];

    expect(privateBlobRefsOf(attachments)).toEqual([
      { blobId: 'file-1' },
      { blobId: 'preview-1', origin: 'https://node-a.example' },
    ]);
  });

  it('returns nothing for public attachments without blobs', () => {
    expect(
      privateBlobRefsOf([{ cid: 'external-1' } as MessageAttachment]),
    ).toEqual([]);
  });
});
