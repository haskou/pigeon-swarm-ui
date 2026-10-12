import type { Community } from '../../../../shared/domain/pigeonResources.types';

export type MemberEventDetails = {
  community?: Community;
  communityId?: string;
  identityId?: string;
  leaving: boolean;
};
