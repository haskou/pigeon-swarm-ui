import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import {
  identityPicture,
  publicFileObjectUrl,
} from '../../../identities/presentation/view-models/identityDisplay';

export async function loadIdentityPicture(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  try {
    return await loadPublicImage(pictureCid);
  } catch {
    return null;
  }
}

export async function loadPublicImage(cid: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const content = await applicationContainer.getPublicFile(cid);

      return publicFileObjectUrl(content);
    } catch {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 250 * (attempt + 1)),
      );
    }
  }

  return null;
}
