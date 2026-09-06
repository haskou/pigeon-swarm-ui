import type { IdentityResource } from '../../../../../shared/domain/pigeonResources.types';

import {
  identityPicture,
  isValidHandle,
  normalizeHandle,
  profilePictureDataUrl,
  profilePictureUrl,
  publicFileObjectUrl,
  identityName,
} from '../../../../../contexts/identities/presentation/view-models/identityDisplay';
import { isIndependentClient } from '../../../../../shared/infrastructure/client/isIndependentClient';

jest.mock(
  '../../../../../shared/infrastructure/client/isIndependentClient',
  () => ({
    isIndependentClient: jest.fn(() => false),
  }),
);

const identity = {
  profile: {
    handle: 'ada_42',
    name: 'Ada',
  },
} as IdentityResource;

describe('identity display helpers', () => {
  afterEach(() => jest.mocked(isIndependentClient).mockReturnValue(false));

  it.each([
    'https://tracker.example/avatar',
    'http://localhost/avatar',
    '//tracker.example/avatar',
    '/avatar',
  ])(
    'rejects external or path-based profile references in independent mode: %s',
    (url) => {
      jest.mocked(isIndependentClient).mockReturnValue(true);
      expect(profilePictureUrl(url)).toBeNull();
    },
  );

  it('retains embedded profile images in independent mode', () => {
    jest.mocked(isIndependentClient).mockReturnValue(true);
    expect(profilePictureUrl('data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc',
    );
  });

  it('formats display names without appending handles', () => {
    expect(identityName(identity)).toBe('Ada');
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
