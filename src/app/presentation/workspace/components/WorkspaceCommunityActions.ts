import type { CommunityChannelResource as CommunityChannel } from '../../../../contexts/communities/infrastructure/http/resources/CommunityChannelResource';
import type { CommunityMembershipRequestResource as CommunityMembershipRequest } from '../../../../contexts/communities/infrastructure/http/resources/CommunityMembershipRequestResource';
import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

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
