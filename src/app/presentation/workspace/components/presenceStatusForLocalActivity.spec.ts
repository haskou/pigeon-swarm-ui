import type {
  IdentityPresence,
  SelectablePresenceStatus,
} from '../../../../shared/domain/pigeonResources.types';

import { presenceStatusForLocalActivity } from './presenceStatusForLocalActivity';

function presence(status: IdentityPresence['status']): IdentityPresence {
  return {
    identityId: 'identity-1',
    status,
    updatedAt: 1770000000000,
  };
}

describe(presenceStatusForLocalActivity.name, () => {
  it.each(['away', 'disconnected'] as const)(
    'restores %s presence to available when local activity resumes',
    (status) => {
      expect(
        presenceStatusForLocalActivity({
          ownPresence: presence(status),
          preferredStatus: null,
        }),
      ).toBe('available');
    },
  );

  it.each(['busy', 'away', 'invisible'] as SelectablePresenceStatus[])(
    'restores the manual %s preference instead of overriding it',
    (preferredStatus) => {
      expect(
        presenceStatusForLocalActivity({
          ownPresence: presence('disconnected'),
          preferredStatus,
        }),
      ).toBe(preferredStatus);
    },
  );

  it('publishes the preferred status when no presence has been loaded yet', () => {
    expect(
      presenceStatusForLocalActivity({
        preferredStatus: 'busy',
      }),
    ).toBe('busy');
  });

  it('keeps the local manual preference authoritative after activity', () => {
    expect(
      presenceStatusForLocalActivity({
        ownPresence: presence('available'),
        preferredStatus: 'busy',
      }),
    ).toBe('busy');
  });

  it.each(['available', 'busy', 'invisible'] as const)(
    'does not republish when current presence is already %s',
    (status) => {
      expect(
        presenceStatusForLocalActivity({
          ownPresence: presence(status),
          preferredStatus: 'available',
        }),
      ).toBeNull();
    },
  );
});
