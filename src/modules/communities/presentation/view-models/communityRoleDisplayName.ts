import type { CommunityRoleResource } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function communityRoleDisplayName(
  role: CommunityRoleResource,
): string {
  return role.id === 'everyone' ? copy.communities.visibleToEveryone : role.name;
}
