import type { CommunityMemberRolesAssigner } from '../../../contexts/communities/application/assign-community-member-roles/CommunityMemberRolesAssigner';
import type { CommunityMemberBanner } from '../../../contexts/communities/application/ban-community-member/CommunityMemberBanner';
import type { CommunityChannelCreator } from '../../../contexts/communities/application/create-community-channel/CommunityChannelCreator';
import type { CommunityRoleCreator } from '../../../contexts/communities/application/create-community-role/CommunityRoleCreator';
import type { CommunityFinder } from '../../../contexts/communities/application/find-community/CommunityFinder';
import type { CommunityMemberKicker } from '../../../contexts/communities/application/kick-community-member/CommunityMemberKicker';
import type { CommunityChannelRemover } from '../../../contexts/communities/application/remove-community-channel/CommunityChannelRemover';
import type { CommunityRoleRemover } from '../../../contexts/communities/application/remove-community-role/CommunityRoleRemover';
import type { CommunityChannelRenamer } from '../../../contexts/communities/application/rename-community-channel/CommunityChannelRenamer';
import type { CommunitiesSearcher } from '../../../contexts/communities/application/search-communities/CommunitiesSearcher';
import type { CommunityMemberUnbanner } from '../../../contexts/communities/application/unban-community-member/CommunityMemberUnbanner';
import type { CommunityChannelPermissionsUpdater } from '../../../contexts/communities/application/update-community-channel-permissions/CommunityChannelPermissionsUpdater';
import type { CommunityRoleUpdater } from '../../../contexts/communities/application/update-community-role/CommunityRoleUpdater';

export type CommunityManagementUseCases = Readonly<{
  assigner: CommunityMemberRolesAssigner;
  banner: CommunityMemberBanner;
  channelCreator: CommunityChannelCreator;
  channelRemover: CommunityChannelRemover;
  channelRenamer: CommunityChannelRenamer;
  finder: CommunityFinder;
  kicker: CommunityMemberKicker;
  permissionsUpdater: CommunityChannelPermissionsUpdater;
  roleCreator: CommunityRoleCreator;
  roleRemover: CommunityRoleRemover;
  roleUpdater: CommunityRoleUpdater;
  searcher: CommunitiesSearcher;
  unbanner: CommunityMemberUnbanner;
}>;
