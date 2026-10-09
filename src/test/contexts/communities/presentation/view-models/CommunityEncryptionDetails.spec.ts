import type { Community } from '../../../../../shared/domain/pigeonResources.types';

import { CommunityEncryptionDetails } from '../../../../../contexts/communities/presentation/view-models/CommunityEncryptionDetails';

describe('CommunityEncryptionDetails', () => {
  const community = {
    id: 'community-identifier',
    name: 'Community',
  } as Community;

  it('describes public communities without exposing secrets', () => {
    const details = CommunityEncryptionDetails.create({
      channelEncryptionReady: false,
      community,
      communityIsPublic: true,
      networkName: 'Public network',
    });

    expect(details.status).toBe('public');
    expect(details.secrets).toEqual([]);
  });

  it('marks private communities this device cannot read as missing', () => {
    const details = CommunityEncryptionDetails.create({
      channelEncryptionReady: false,
      community,
      communityIsPublic: false,
      networkName: 'Private network',
    });

    expect(details.status).toBe('missing');
    expect(details.secrets).toEqual([]);
  });
});
