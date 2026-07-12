import { useEffect, useState } from 'react';

import type {
  Community,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { loadPublicImage } from '../../../communities/presentation/components/communityImages';

interface UseNotificationCommunityPreviewsInput {
  communities: Community[];
  session: Session;
  visibleNotifications: NotificationResource[];
}

export function useNotificationCommunityPreviews({
  communities,
  session,
  visibleNotifications,
}: UseNotificationCommunityPreviewsInput): {
  communityAvatarUrls: Record<string, string>;
  communityPreviews: Record<string, Community>;
} {
  const [communityPreviews, setCommunityPreviews] = useState<
    Record<string, Community>
  >({});
  const [communityAvatarUrls, setCommunityAvatarUrls] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const communityIds = visibleNotifications
      .filter((notification) => notification.type === 'community_invitation')
      .map((notification) => notification.payload.communityId)
      .filter(
        (communityId) =>
          !communities.some((community) => community.id === communityId) &&
          !communityPreviews[communityId],
      );

    if (communityIds.length === 0) return;

    let cancelled = false;

    void Promise.all(
      [...new Set(communityIds)].map((communityId) =>
        applicationContainer
          .communities.get(session, communityId)
          .then((community) => [communityId, community] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;

      const loaded = results.filter(
        (result): result is readonly [string, Community] => result !== null,
      );

      if (loaded.length === 0) return;

      setCommunityPreviews((current) => ({
        ...current,
        ...Object.fromEntries(loaded),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [communities, communityPreviews, session, visibleNotifications]);

  useEffect(() => {
    const communityIds = [
      ...new Set(
        visibleNotifications
          .filter(
            (notification) => notification.type === 'community_invitation',
          )
          .map((notification) => notification.payload.communityId),
      ),
    ];
    const communitiesById = new Map(
      [...communities, ...Object.values(communityPreviews)].map((community) => [
        community.id,
        community,
      ]),
    );
    const avatarEntries = communityIds
      .map((communityId) => communitiesById.get(communityId))
      .filter(
        (community): community is Community =>
          !!community?.avatar && !communityAvatarUrls[community.id],
      );

    if (avatarEntries.length === 0) return;

    let cancelled = false;

    void Promise.all(
      avatarEntries.map((community) =>
        loadPublicImage(community.avatar as string)
          .then((url) => (url ? ([community.id, url] as const) : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;

      const loaded = results.filter(
        (result): result is readonly [string, string] => result !== null,
      );

      if (loaded.length === 0) return;

      setCommunityAvatarUrls((current) => ({
        ...current,
        ...Object.fromEntries(loaded),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [
    communities,
    communityAvatarUrls,
    communityPreviews,
    visibleNotifications,
  ]);

  return { communityAvatarUrls, communityPreviews };
}
