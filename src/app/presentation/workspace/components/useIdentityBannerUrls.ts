import { useEffect, useState } from 'react';

import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { loadPublicImage } from '../../../../contexts/communities/presentation/components/communityImages';
import { identityBanner } from '../../../../contexts/identities/presentation/view-models/identityDisplay';

type LoadedBanner = { bannerId: string; url: string };

function retainCurrentBanners(
  current: Record<string, LoadedBanner>,
  identities: Record<string, IdentityResource>,
  identityIdsByKey: Record<string, string>,
): Record<string, LoadedBanner> {
  const validBannerIdsByKey = Object.fromEntries(
    Object.entries(identityIdsByKey).map(([key, identityId]) => [
      key,
      identities[identityId]?.profile.banner?.trim() ?? '',
    ]),
  );
  const retained = Object.fromEntries(
    Object.entries(current).filter(
      ([key, banner]) => validBannerIdsByKey[key] === banner.bannerId,
    ),
  );

  return Object.keys(retained).length === Object.keys(current).length
    ? current
    : retained;
}

async function loadBannerUrls(
  identities: Record<string, IdentityResource>,
  identityIdsByKey: Record<string, string>,
): Promise<Record<string, LoadedBanner>> {
  const loaded = await Promise.all(
    Object.entries(identityIdsByKey).map(async ([key, identityId]) => {
      const identity = identities[identityId];
      const bannerId = identity?.profile.banner?.trim();

      if (!identity || !bannerId) return null;

      const url = identityBanner(identity) ?? (await loadPublicImage(bannerId));

      return url ? ([key, { bannerId, url }] as const) : null;
    }),
  );

  return Object.fromEntries(loaded.filter((entry) => entry !== null));
}

export function useIdentityBannerUrls(
  identities: Record<string, IdentityResource>,
  identityIdsByKey: Record<string, string>,
): Record<string, string> {
  const [bannerUrls, setBannerUrls] = useState<Record<string, LoadedBanner>>(
    {},
  );

  useEffect(() => {
    setBannerUrls((current) =>
      retainCurrentBanners(current, identities, identityIdsByKey),
    );
    let cancelled = false;

    void loadBannerUrls(identities, identityIdsByKey)
      .then((loadedBanners) => {
        if (cancelled) return;

        setBannerUrls((current) => ({
          ...current,
          ...loadedBanners,
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [identities, identityIdsByKey]);

  return Object.fromEntries(
    Object.entries(bannerUrls).map(([key, banner]) => [key, banner.url]),
  );
}
