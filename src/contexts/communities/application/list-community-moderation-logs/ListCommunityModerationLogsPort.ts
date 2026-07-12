import type {
  CommunityModerationLogPage,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface ListCommunityModerationLogsPort {
  listCommunityModerationLogs(
    session: Session,
    communityId: string,
    input?: { beforeLogId?: string; limit?: number },
  ): Promise<CommunityModerationLogPage>;
}
