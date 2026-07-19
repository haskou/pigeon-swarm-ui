import { useEffect, useState } from 'react';

import type { Community } from '../../../../shared/domain/pigeonResources.types';

import { loadPublicImage } from './communityImages';

export interface CommunityVisualAssetsController {
  avatarUrl: string | null;
  avatarViewerOpen: boolean;
  bannerUrl: string | null;
  bannerViewerOpen: boolean;
  closeAvatarViewer: () => void;
  closeBannerViewer: () => void;
  openAvatarViewer: () => void;
  openBannerViewer: () => void;
}

function useCommunityImage(imageId?: null | string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const normalizedImageId = imageId?.trim();

    setUrl(null);

    if (!normalizedImageId) return undefined;

    let cancelled = false;

    void loadPublicImage(normalizedImageId).then((loadedUrl) => {
      if (!cancelled) setUrl(loadedUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  return url;
}

export function useCommunityVisualAssets(
  community: Community,
): CommunityVisualAssetsController {
  const avatarUrl = useCommunityImage(community.avatar);
  const bannerUrl = useCommunityImage(community.banner);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [bannerViewerOpen, setBannerViewerOpen] = useState(false);

  useEffect(() => setAvatarViewerOpen(false), [community.avatar]);
  useEffect(() => setBannerViewerOpen(false), [community.banner]);

  return {
    avatarUrl,
    avatarViewerOpen,
    bannerUrl,
    bannerViewerOpen,
    closeAvatarViewer: () => setAvatarViewerOpen(false),
    closeBannerViewer: () => setBannerViewerOpen(false),
    openAvatarViewer: () => setAvatarViewerOpen(true),
    openBannerViewer: () => setBannerViewerOpen(true),
  };
}
