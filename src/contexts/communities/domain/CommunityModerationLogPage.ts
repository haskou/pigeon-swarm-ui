import type { CommunityModerationLog } from './CommunityModerationLog';

export type CommunityModerationLogPage = {
  logs: CommunityModerationLog[];
  nextBeforeLogId?: string;
};
