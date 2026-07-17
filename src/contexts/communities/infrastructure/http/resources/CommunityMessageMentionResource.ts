export type CommunityMessageMentionResource =
  | { type: 'everyone' }
  | { type: 'here' }
  | { targetId: string; type: 'identity' }
  | { targetId: string; type: 'role' };
