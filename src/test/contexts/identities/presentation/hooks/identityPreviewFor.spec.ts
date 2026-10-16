import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';

import { identityPreviewFor } from '../../../../../contexts/identities/presentation/hooks/identityPreviewFor';

const identity = { id: 'identity-a' } as IdentityResource;

describe(identityPreviewFor.name, () => {
  it('is loaded and empty without an identity to look up', () => {
    expect(identityPreviewFor(undefined, null)).toEqual({
      identity: null,
      loaded: true,
      pictureUrl: null,
    });
  });

  it('is not loaded before the lookup of the requested identity resolves', () => {
    expect(identityPreviewFor('identity-a', null)).toEqual({
      identity: null,
      loaded: false,
      pictureUrl: null,
    });
  });

  it('is not loaded while it still holds the lookup of another identity', () => {
    expect(
      identityPreviewFor('identity-b', {
        identity,
        identityId: 'identity-a',
        pictureUrl: 'picture-a',
      }),
    ).toEqual({ identity: null, loaded: false, pictureUrl: null });
  });

  it('returns the lookup of the requested identity', () => {
    expect(
      identityPreviewFor('identity-a', {
        identity,
        identityId: 'identity-a',
        pictureUrl: 'picture-a',
      }),
    ).toEqual({ identity, loaded: true, pictureUrl: 'picture-a' });
  });

  it('is loaded and empty when the lookup of the requested identity failed', () => {
    expect(
      identityPreviewFor('identity-a', {
        identity: null,
        identityId: 'identity-a',
        pictureUrl: null,
      }),
    ).toEqual({ identity: null, loaded: true, pictureUrl: null });
  });
});
