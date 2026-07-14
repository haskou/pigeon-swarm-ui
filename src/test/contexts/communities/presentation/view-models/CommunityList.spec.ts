import type { Community } from '../../../../../contexts/communities/domain/Community';

import { CommunityList } from '../../../../../contexts/communities/presentation/view-models/CommunityList';

describe(CommunityList.name, () => {
  it('keeps one community per id preserving the first occurrence', () => {
    const original = community({ description: 'old', id: 'community-1' });
    const updated = community({ description: 'updated', id: 'community-1' });
    const other = community({ id: 'community-2' });

    expect(CommunityList.withUniqueIds([updated, other, original])).toEqual([
      updated,
      other,
    ]);
  });

  it('keeps the same array instance when ids are already unique', () => {
    const communities = [community({ id: 'community-1' })];

    expect(CommunityList.withUniqueIds(communities)).toBe(communities);
  });

  it('preserves runtime voice presence when community resources reload', () => {
    const current = community({
      voiceChannels: [
        {
          connectedIdentityIds: ['identity-2'],
          createdAt: 1,
          id: 'voice-1',
          name: 'Hangout',
          type: 'voice',
        },
      ],
    });
    const reloaded = community({
      description: 'updated',
      voiceChannels: [
        {
          connectedIdentityIds: [],
          createdAt: 1,
          id: 'voice-1',
          name: 'Hangout',
          type: 'voice',
        },
      ],
    });

    expect(
      CommunityList.preservingVoicePresence([reloaded], [current]),
    ).toEqual([
      expect.objectContaining({
        description: 'updated',
        voiceChannels: [
          expect.objectContaining({ connectedIdentityIds: ['identity-2'] }),
        ],
      }),
    ]);
  });
});

function community(overrides: Partial<Community> = {}): Community {
  return {
    createdAt: 1,
    description: 'description',
    id: 'community-1',
    memberIds: [],
    name: 'Community',
    networkId: 'network-1',
    ownerIdentityId: 'identity-1',
    textChannels: [],
    visibility: 'private',
    ...overrides,
  };
}
