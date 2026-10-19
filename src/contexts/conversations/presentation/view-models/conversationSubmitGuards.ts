/**
 * A direct conversation is submitted only on a shared private network. A
 * loading or failed node list, or no shared private network, blocks it.
 */
export function canSubmitDirectConversation({
  busy,
  contactBlocked,
  hasExistingConversation,
  hasNetwork,
  hasPeer,
  networksFailed,
  networksLoading,
}: {
  busy: boolean;
  contactBlocked: boolean;
  hasExistingConversation: boolean;
  hasNetwork: boolean;
  hasPeer: boolean;
  networksFailed: boolean;
  networksLoading: boolean;
}): boolean {
  return (
    hasPeer &&
    hasNetwork &&
    !hasExistingConversation &&
    !contactBlocked &&
    !networksLoading &&
    !networksFailed &&
    !busy
  );
}

/**
 * A group also places on private networks only, so the same node list rules
 * apply.
 */
export function canSubmitGroupConversation({
  busy,
  hasGroupName,
  hasNetwork,
  hasParticipants,
  networksFailed,
  networksLoading,
}: {
  busy: boolean;
  hasGroupName: boolean;
  hasNetwork: boolean;
  hasParticipants: boolean;
  networksFailed: boolean;
  networksLoading: boolean;
}): boolean {
  return (
    hasGroupName &&
    hasParticipants &&
    hasNetwork &&
    !networksLoading &&
    !networksFailed &&
    !busy
  );
}
