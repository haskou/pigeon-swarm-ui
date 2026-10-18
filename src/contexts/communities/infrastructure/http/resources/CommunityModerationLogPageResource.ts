import type { CommunityModerationLogResource } from './CommunityModerationLogResource';

export type CommunityModerationLogPageResource = {
  logs: CommunityModerationLogResource[];
  nextCursor: string | null;
};
