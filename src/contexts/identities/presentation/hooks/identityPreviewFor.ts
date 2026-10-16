import type { IdentityResource } from '../../infrastructure/http/resources/IdentityResource';

export type IdentityPreview = {
  identity: IdentityResource | null;
  loaded: boolean;
  pictureUrl: string | null;
};

export type LoadedIdentityPreview = {
  identity: IdentityResource | null;
  identityId: string;
  pictureUrl: string | null;
};

/**
 * The preview of the requested identity. A lookup that resolved for another
 * identity is not loaded yet, so a caller never sees a settled state for an
 * identifier whose lookup has not finished.
 */
export function identityPreviewFor(
  identityId: string | undefined,
  loadedPreview: LoadedIdentityPreview | null,
): IdentityPreview {
  if (!identityId) return { identity: null, loaded: true, pictureUrl: null };

  if (loadedPreview?.identityId !== identityId)
    return { identity: null, loaded: false, pictureUrl: null };

  return {
    identity: loadedPreview.identity,
    loaded: true,
    pictureUrl: loadedPreview.pictureUrl,
  };
}
