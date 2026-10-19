import type { CommunityVisibilityResource as CommunityVisibility } from '../../infrastructure/http/resources/CommunityVisibilityResource';

/**
 * A private community needs a private network from a loaded node list, so a
 * loading or failed list blocks it. Public communities keep every identity
 * network and are not blocked by the node list.
 */
export function canSubmitCommunity({
  busy,
  channelsValid,
  hasName,
  hasNetwork,
  networksFailed,
  networksLoading,
  visibility,
}: {
  busy: boolean;
  channelsValid: boolean;
  hasName: boolean;
  hasNetwork: boolean;
  networksFailed: boolean;
  networksLoading: boolean;
  visibility: CommunityVisibility;
}): boolean {
  const privateNodeListPending =
    visibility === 'private' && (networksLoading || networksFailed);

  return (
    hasName &&
    channelsValid &&
    hasNetwork &&
    !privateNodeListPending &&
    !busy
  );
}
