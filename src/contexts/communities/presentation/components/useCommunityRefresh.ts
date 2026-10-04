import { useEffect, useRef } from 'react';

import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';

export function useCommunityRefresh(
  community: Community,
  onCommunityUpdated: (community: Community) => void,
  session: Session,
): void {
  const onCommunityUpdatedRef = useRef(onCommunityUpdated);

  useEffect(() => {
    onCommunityUpdatedRef.current = onCommunityUpdated;
  }, [onCommunityUpdated]);

  useEffect(() => {
    let cancelled = false;

    void applicationContainer.communities
      .get(session, community.id)
      .then((freshCommunity) => {
        if (!cancelled) onCommunityUpdatedRef.current(freshCommunity);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [community.id, session]);
}
