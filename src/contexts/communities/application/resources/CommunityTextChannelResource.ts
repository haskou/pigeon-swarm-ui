import type { CommunityChannelPermissionsResource } from './CommunityChannelPermissionsResource';
import type { CommunityChannelThreadSummaryResource } from './CommunityChannelThreadSummaryResource';

export type CommunityTextChannelResource = {
  createdAt: number;
  id: string;
  name: string;
  permissions?: CommunityChannelPermissionsResource;
  threads?: CommunityChannelThreadSummaryResource[];
  type: 'text';
};
