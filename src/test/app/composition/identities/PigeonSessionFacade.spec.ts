import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesFacade } from '../../../../app/composition/identities/PigeonIdentitiesFacade';
import type { PigeonIdentitiesGateway } from '../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { PigeonSessionFacade } from '../../../../app/composition/identities/PigeonSessionFacade';

describe(PigeonSessionFacade.name, () => {
  it('orders conversations when refreshing a session', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const identities = mock<PigeonIdentitiesFacade>();
    const session = {} as Session;

    gateway.refreshSession.mockResolvedValue({
      conversations: [
        { id: 'older', latestMessageAt: 1, networkId: 'network-a' },
        { id: 'newer', latestMessageAt: 2, networkId: 'network-a' },
      ],
      session,
    });

    const result = await new PigeonSessionFacade(gateway, identities).refresh(
      session,
    );

    expect(result.conversations.map(({ id }) => id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('delegates remembered identity restoration to the identity facade', async () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const identities = mock<PigeonIdentitiesFacade>();
    const expected = { conversations: [], session: {} as Session };

    identities.restoreRemembered.mockResolvedValue(expected);

    await expect(
      new PigeonSessionFacade(gateway, identities).restoreRemembered(
        'identity-a',
      ),
    ).resolves.toBe(expected);
  });
});
