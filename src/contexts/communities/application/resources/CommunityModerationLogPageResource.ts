import type { CommunityModerationLogResource } from './CommunityModerationLogResource';

export type CommunityModerationLogPageResource = {
  logs: CommunityModerationLogResource[];
  nextBeforeLogId?: string;
};
