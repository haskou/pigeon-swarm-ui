import type { CommunityChannelPermissions } from './CommunityChannelPermissions';
import type { CommunityChannelThreadSummary } from './CommunityChannelThreadSummary';

export type CommunityTextChannel = {
  createdAt: number;
  id: string;
  name: string;
  permissions?: CommunityChannelPermissions;
  threads?: CommunityChannelThreadSummary[];
  type: 'text';
};
