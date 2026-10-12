import type {
  Community,
  CommunityChannel,
  CommunityMembershipRequest,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export type WorkspaceCommunityActions = {
  create: (input: { community: Community; session: Session }) => void;
  joinRequested: (request: CommunityMembershipRequest) => void;
  leave: (community: Community) => Promise<void>;
  remove: (community: Community) => void;
  update: (community: Community) => void;
  updateChannels: (communityId: string, channels: CommunityChannel[]) => void;
  updateState: (
    communityId: string,
    updater: (community: Community) => Community,
  ) => void;
};
