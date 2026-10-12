import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';

export type MemberEventDetails = {
  community?: Community;
  communityId?: string;
  identityId?: string;
  leaving: boolean;
};
