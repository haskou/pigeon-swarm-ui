import { useEffect, useState } from 'react';

import type { IdentityResource } from '../../infrastructure/http/resources/IdentityResource';
import type {
  IdentityPreview,
  LoadedIdentityPreview,
} from './identityPreviewFor';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import {
  identityPicture,
  publicFileObjectUrl,
} from '../view-models/identityDisplay';
import { identityPreviewFor } from './identityPreviewFor';

export function useIdentityPreview(
  identityId: string | undefined,
  fallbackIdentity?: IdentityResource,
): IdentityPreview {
  const [loadedPreview, setLoadedPreview] =
    useState<LoadedIdentityPreview | null>(null);

  useEffect(() => {
    if (!identityId) return undefined;

    let cancelled = false;

    const loadPreview = async () => {
      try {
        const identity =
          fallbackIdentity?.id === identityId
            ? fallbackIdentity
            : await applicationContainer.identities.get(identityId);
        const pictureUrl = await loadIdentityPictureUrl(identity);

        if (!cancelled) setLoadedPreview({ identity, identityId, pictureUrl });
      } catch {
        if (!cancelled)
          setLoadedPreview({ identity: null, identityId, pictureUrl: null });
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [fallbackIdentity, identityId]);

  return identityPreviewFor(identityId, loadedPreview);
}

async function loadIdentityPictureUrl(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  try {
    return publicFileObjectUrl(
      await applicationContainer.attachments.getPublicFile(pictureCid),
    );
  } catch {
    return null;
  }
}
