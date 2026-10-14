import type { IdentityPresenceResource as IdentityPresence } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityPresenceResource';

import { ownPresenceWithLocalPreference } from '../../../../../app/presentation/workspace/components/ownPresenceWithLocalPreference';

const OWN_ID = 'MCowBQYDK2VwAyEAown';
const presence = (
  status: IdentityPresence['status'],
  identityId = OWN_ID,
): IdentityPresence => ({ identityId, status, updatedAt: 1770000000000 });

describe(ownPresenceWithLocalPreference.name, () => {
  it('keeps a manual away preference when a realtime event reports the user as available', () => {
    expect(
      ownPresenceWithLocalPreference(presence('available'), OWN_ID, 'away'),
    ).toEqual(presence('away'));
  });

  it('keeps the preference for the own presence reported in PEM form', () => {
    const own = presence(
      'available',
      `-----BEGIN PUBLIC KEY-----\n${OWN_ID}\n-----END PUBLIC KEY-----\n`,
    );

    expect(ownPresenceWithLocalPreference(own, OWN_ID, 'away')).toEqual({
      ...own,
      status: 'away',
    });
  });

  it('passes the reported presence through without a manual preference', () => {
    expect(
      ownPresenceWithLocalPreference(presence('busy'), OWN_ID, null),
    ).toEqual(presence('busy'));
  });

  it('ignores the presence of other identities and rejected ids', () => {
    expect(
      ownPresenceWithLocalPreference(
        presence('available', 'MCowBQYDK2VwAyEAother'),
        OWN_ID,
        'away',
      ),
    ).toBeNull();
    expect(
      ownPresenceWithLocalPreference(
        presence('available', 'x'.repeat(5000)),
        OWN_ID,
        'away',
      ),
    ).toBeNull();
  });
});
