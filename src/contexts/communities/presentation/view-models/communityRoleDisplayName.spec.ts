import type { CommunityRoleResource } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { communityRoleDisplayName } from './communityRoleDisplayName';

describe(communityRoleDisplayName.name, () => {
  it('localizes the built-in everyone role', () => {
    expect(
      communityRoleDisplayName({
        builtIn: true,
        id: 'everyone',
        name: 'everyone',
        permissions: [],
      } as CommunityRoleResource),
    ).toBe(copy.communities.visibleToEveryone);
  });

  it('keeps custom role names as authored', () => {
    expect(
      communityRoleDisplayName({
        id: 'role-a',
        name: 'Ops',
        permissions: [],
      } as CommunityRoleResource),
    ).toBe('Ops');
  });
});
