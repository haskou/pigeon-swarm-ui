import { mock } from 'jest-mock-extended';

import type { PigeonIdentitiesFacade } from '../../../../app/composition/identities/PigeonIdentitiesFacade';
import type { PigeonIdentitiesGateway } from '../../../../contexts/identities/infrastructure/http/PigeonIdentitiesGateway';
import type { Session } from '../../../../shared/domain/pigeonResources.types';

import { ConversationKeychainRecovery } from '../../../../app/composition/identities/ConversationKeychainRecovery';
import { PigeonSessionFacade } from '../../../../app/composition/identities/PigeonSessionFacade';
import { ConversationIdFactory } from '../../../../contexts/conversations/domain/ConversationIdFactory';

describe(PigeonSessionFacade.name, () => {
  it('recovers legacy keys when conversations arrive after the session was restored', () => {
    const gateway = mock<PigeonIdentitiesGateway>();
    const identities = mock<PigeonIdentitiesFacade>();
    const canonicalId =
      'one-to-one:52fec0e89606c6eda26359e7b3c9fb5eaffbc6082dce7cbcd2e35c9c104e5183';
    const legacyId =
      'one-to-one:7006bcc28bce585c410f07c2e0d6cac4565bd3cc62023603e59000bd07cc3bd2';
    const session = {
      identity: { id: 'identity-a' },
      keychain: {
        conversations: {
          [legacyId]: {
            algorithm: 'aes-256-gcm',
            conversationId: legacyId,
            createdAt: 1,
            key: 'existing-key',
            kind: 'conversation',
            peerIdentityId: 'identity-B',
            version: 2,
          },
        },
        version: 3,
      },
    } as unknown as Session;
    const facade = new PigeonSessionFacade(
      gateway,
      identities,
      new ConversationKeychainRecovery(new ConversationIdFactory()),
    );
    const restored = facade.recoverConversationKeys(session, []);

    const recovered = facade.recoverConversationKeys(restored, [
      {
        id: canonicalId,
        networkId: 'network-1',
        peerIdentityId: 'identity-B',
        type: 'one-to-one',
      },
    ]);

    expect(restored.keychain.conversations[canonicalId]).toBeUndefined();
    expect(recovered.keychain.conversations[canonicalId]).toEqual(
      expect.objectContaining({
        conversationId: canonicalId,
        key: 'existing-key',
      }),
    );
    expect(
      facade.recoverConversationKeys(recovered, [
        {
          id: canonicalId,
          networkId: 'network-1',
          peerIdentityId: 'identity-B',
        },
      ]),
    ).toBe(recovered);
  });

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

    const result = await new PigeonSessionFacade(
      gateway,
      identities,
      new ConversationKeychainRecovery(new ConversationIdFactory()),
    ).refresh(session);

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
      new PigeonSessionFacade(
        gateway,
        identities,
        new ConversationKeychainRecovery(new ConversationIdFactory()),
      ).restoreRemembered('identity-a'),
    ).resolves.toBe(expected);
  });
});
