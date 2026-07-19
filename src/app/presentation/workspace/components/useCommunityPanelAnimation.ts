import { useRef } from 'react';

export function useCommunityPanelAnimation(
  activeCommunityId: null | string,
): boolean {
  const initialCommunityId = useRef<null | string>(null);

  if (!initialCommunityId.current && activeCommunityId) {
    initialCommunityId.current = activeCommunityId;
  }

  return Boolean(
    activeCommunityId && activeCommunityId !== initialCommunityId.current,
  );
}
