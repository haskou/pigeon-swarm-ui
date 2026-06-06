export type CommunityMessageMention =
  | { type: 'everyone' }
  | { type: 'here' }
  | { targetId: string; type: 'identity' }
  | { targetId: string; type: 'role' };
