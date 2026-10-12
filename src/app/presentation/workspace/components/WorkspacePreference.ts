export type WorkspacePreference = {
  channelByCommunityId?: Record<string, string>;
  communityId?: null | string;
  mode?: 'community' | 'messages';
};
