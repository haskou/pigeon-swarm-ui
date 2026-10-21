export type CommunityListLoad = {
  identityId: string;
  /** False once the load was replaced, cancelled or its session ended. */
  isCurrent: () => boolean;
  signal: AbortSignal;
};
