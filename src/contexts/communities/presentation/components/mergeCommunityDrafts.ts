export function mergeCommunityDrafts(
  current: Record<string, string>,
  remoteDrafts: Array<{
    channelId: string;
    communityId: string;
    content: string;
  }>,
  communityId: string,
): Record<string, string> {
  const next = { ...current };

  for (const draft of remoteDrafts) {
    if (
      draft.communityId === communityId &&
      next[draft.channelId] === undefined
    ) {
      next[draft.channelId] = draft.content;
    }
  }

  return next;
}
