import { useEffect, useState } from 'react';

import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import {
  identityPicture,
  publicFileObjectUrl,
} from '../view-models/identityDisplay';

export type IdentityPreview = {
  identity: IdentityResource | null;
  loaded: boolean;
  pictureUrl: string | null;
};

export function useIdentityPreview(
  identityId: string | undefined,
  fallbackIdentity?: IdentityResource,
): IdentityPreview {
  const [preview, setPreview] = useState<IdentityPreview>({
    identity: null,
    loaded: !identityId,
    pictureUrl: null,
  });

  useEffect(() => {
    if (!identityId) {
      setPreview({ identity: null, loaded: true, pictureUrl: null });

      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setPreview({ identity: null, loaded: false, pictureUrl: null });

      try {
        const identity =
          fallbackIdentity?.id === identityId
            ? fallbackIdentity
            : await applicationContainer.getIdentity(identityId);
        const pictureUrl = await loadIdentityPictureUrl(identity);

        if (!cancelled) {
          setPreview({ identity, loaded: true, pictureUrl });
        }
      } catch {
        if (!cancelled) {
          setPreview({ identity: null, loaded: true, pictureUrl: null });
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [fallbackIdentity, identityId]);

  return preview;
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
      await applicationContainer.getPublicFile(pictureCid),
    );
  } catch {
    return null;
  }
}
