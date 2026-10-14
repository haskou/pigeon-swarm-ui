import { mock } from 'jest-mock-extended';

import type { NotificationUseCases } from '../../../../app/composition/notifications/NotificationUseCases';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { PushNotificationServerFinder } from '../../../../contexts/notifications/application/find-push-notification-server/PushNotificationServerFinder';
import type { PushSubscriptionRegistrar } from '../../../../contexts/notifications/application/register-push-subscription/PushSubscriptionRegistrar';
import type { PushSubscriptionRemover } from '../../../../contexts/notifications/application/remove-push-subscription/PushSubscriptionRemover';
import type { NotificationsSearcher } from '../../../../contexts/notifications/application/search-notifications/NotificationsSearcher';
import type { NotificationResource } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import { PigeonNotificationsFacade } from '../../../../app/composition/notifications/PigeonNotificationsFacade';
import { PushNotificationServer } from '../../../../contexts/notifications/domain/PushNotificationServer';
import { NotificationAccessContexts } from '../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { NotificationMapper } from '../../../../contexts/notifications/infrastructure/http/NotificationMapper';
import { NotificationSettingMapper } from '../../../../contexts/notifications/infrastructure/http/NotificationSettingMapper';

function invitation(
  id: string,
  type: 'conversation_invitation' | 'group_conversation_invitation',
): NotificationResource {
  return {
    id,
    payload: {
      conversationId: 'conversation-1',
      encryptedConversationKey: 'sealed',
      inviterIdentityId: 'identity-2',
      nonce: 'nonce-1',
      recipientIdentityId: 'identity-1',
    },
    recipientIdentityId: 'identity-1',
    state: 'pending',
    status: 'unread',
    type,
  };
}

describe(PigeonNotificationsFacade.name, () => {
  it('routes browser subscriptions through application use cases', async () => {
    const useCases = mock<NotificationUseCases>();
    const registrar = mock<PushSubscriptionRegistrar>();
    const remover = mock<PushSubscriptionRemover>();
    useCases.pushSubscriptionRegistrar = registrar;
    useCases.pushSubscriptionRemover = remover;
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      new NotificationMapper(),
      new NotificationSettingMapper(),
      useCases,
    );
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;
    const subscription = {
      endpoint: 'https://push.example/1',
      expirationTime: null,
      keys: { auth: 'auth', p256dh: 'p256dh' },
    };

    await facade.registerPushSubscription(session, subscription);
    await facade.deletePushSubscription(session, subscription);

    const registrationMessage = registrar.register.mock.calls[0]?.[0];
    const removalMessage = remover.remove.mock.calls[0]?.[0];
    expect(registrationMessage?.getEndpoint().toString()).toBe(
      'https://push.example/1',
    );
    expect(registrationMessage?.getRecipientIdentityId().toString()).toBe(
      'identity-1',
    );
    expect(removalMessage?.getSubscription().toPrimitives()).toEqual(
      expect.objectContaining({ endpoint: 'https://push.example/1' }),
    );
  });

  it('projects the push server configuration returned by its finder', async () => {
    const useCases = mock<NotificationUseCases>();
    const finder = mock<PushNotificationServerFinder>();
    useCases.pushServerFinder = finder;
    finder.find.mockResolvedValue(
      PushNotificationServer.fromPrimitives({
        enabled: true,
        publicKey: 'public-key',
      }),
    );
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      new NotificationMapper(),
      new NotificationSettingMapper(),
      useCases,
    );

    await expect(facade.getPushVapidPublicKey()).resolves.toEqual({
      enabled: true,
      publicKey: 'public-key',
    });
  });

  it('keeps group control letters out of the listed notifications', async () => {
    const useCases = mock<NotificationUseCases>();
    const searcher = mock<NotificationsSearcher>();
    const mapper = new NotificationMapper();
    useCases.notificationSearcher = searcher;
    searcher.search.mockResolvedValue([
      mapper.fromResource(invitation('direct', 'conversation_invitation')),
      mapper.fromResource(
        invitation('control', 'group_conversation_invitation'),
      ),
    ]);
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      mapper,
      new NotificationSettingMapper(),
      useCases,
    );

    const listed = await facade.list({
      identity: { id: 'identity-1' },
    } as unknown as Session);

    expect(listed.map(({ id }) => id)).toEqual(['direct']);
  });

  it('refuses to accept a group control letter as an invitation', async () => {
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      new NotificationMapper(),
      new NotificationSettingMapper(),
      mock<NotificationUseCases>(),
    );

    await expect(
      facade.acceptConversationInvitation(
        { identity: { id: 'identity-1' } } as unknown as Session,
        invitation('control', 'group_conversation_invitation'),
      ),
    ).rejects.toThrow('Only one-to-one invitations carry a key to accept.');
  });
});
