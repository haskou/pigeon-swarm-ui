import { isPrivateBlobUploadTicket } from '../../../../../contexts/attachments/domain/value-objects/PrivateBlobUploadTicket';

describe(isPrivateBlobUploadTicket.name, () => {
  it('accepts a ticket with or without a string origin', () => {
    expect(
      isPrivateBlobUploadTicket({ blobId: 'blob-1', uploadToken: 'token-1' }),
    ).toBe(true);
    expect(
      isPrivateBlobUploadTicket({
        blobId: 'blob-1',
        origin: 'https://node-a.example',
        uploadToken: 'token-1',
      }),
    ).toBe(true);
  });

  it.each([
    ['a non-object', 'blob-1'],
    ['null', null],
    ['a missing upload token', { blobId: 'blob-1' }],
    ['a numeric blob id', { blobId: 1, uploadToken: 'token-1' }],
    ['a numeric upload token', { blobId: 'blob-1', uploadToken: 1 }],
    [
      'a null origin',
      { blobId: 'blob-1', origin: null, uploadToken: 'token-1' },
    ],
    [
      'a numeric origin',
      { blobId: 'blob-1', origin: 1, uploadToken: 'token-1' },
    ],
  ])('rejects %s', (_, value) => {
    expect(isPrivateBlobUploadTicket(value)).toBe(false);
  });
});
