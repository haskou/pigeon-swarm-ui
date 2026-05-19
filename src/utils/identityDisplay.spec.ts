import type { IdentityResource } from '../domain/types';

import {
  identityPicture,
  isValidHandle,
  normalizeHandle,
  profilePictureDataUrl,
  profilePictureUrl,
  publicFileObjectUrl,
  identityName,
} from './identityDisplay';

const identity = {
  profile: {
    handle: 'ada_42',
    name: 'Ada',
  },
} as IdentityResource;

describe('identity display helpers', () => {
  it('formats display names with handles', () => {
    expect(identityName(identity)).toBe('Ada (@ada_42)');
  });

  it('normalizes handles', () => {
    expect(normalizeHandle('@Ada_42')).toBe('ada_42');
  });

  it('validates handles', () => {
    expect(isValidHandle('ada_42')).toBe(true);
    expect(isValidHandle('@al')).toBe(false);
    expect(isValidHandle('Ada_42')).toBe(true);
    expect(isValidHandle('Ada!')).toBe(false);
  });

  it('uses direct picture urls as-is', () => {
    expect(profilePictureUrl('data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc',
    );
    expect(profilePictureUrl('https://example.com/avatar.png')).toBe(
      'https://example.com/avatar.png',
    );
  });

  it('does not treat IPFS cids as image urls', () => {
    expect(profilePictureUrl('bafy-avatar')).toBeNull();
    expect(
      identityPicture({
        profile: { name: 'Ada', picture: 'bafy-avatar' },
      } as IdentityResource),
    ).toBeNull();
  });

  it('builds data urls from public IPFS content', () => {
    expect(
      profilePictureDataUrl({
        contentType: 'image/png',
        data: 'abc',
      }),
    ).toBe('data:image/png;base64,abc');
  });

  it('reuses object urls for public IPFS blobs', () => {
    const createObjectUrl = jest.fn().mockReturnValue('blob:avatar');
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = createObjectUrl;
    const blob = new Blob(['abc'], { type: 'image/png' });

    try {
      expect(publicFileObjectUrl({ blob })).toBe('blob:avatar');
      expect(publicFileObjectUrl({ blob })).toBe('blob:avatar');
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
    }
  });
});
