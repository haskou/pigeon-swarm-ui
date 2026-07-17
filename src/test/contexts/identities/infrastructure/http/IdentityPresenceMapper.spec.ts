import type { IdentityPresenceResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';

import { IdentityPresenceMapper } from '../../../../../contexts/identities/infrastructure/http/IdentityPresenceMapper';

describe(IdentityPresenceMapper.name, () => {
  it('round-trips the presence HTTP resource', () => {
    const mapper = new IdentityPresenceMapper();
    const resource: IdentityPresenceResource = {
      identityId: 'identity-a',
      lastActivityAt: 90,
      lastHeartbeatAt: 95,
      networkIds: ['network-a'],
      status: 'busy',
      updatedAt: 100,
    };

    expect(mapper.toResource(mapper.fromResource(resource))).toEqual(resource);
  });
});
