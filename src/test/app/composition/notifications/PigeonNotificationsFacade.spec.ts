import { mock } from 'jest-mock-extended';

import type { NotificationUseCases } from '../../../../app/composition/notifications/NotificationUseCases';
import type { GroupConversationMailbox } from '../../../../contexts/groupMailboxes/infrastructure/GroupConversationMailbox';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { PushNotificationServerFinder } from '../../../../contexts/notifications/application/find-push-notification-server/PushNotificationServerFinder';
import type { PushSubscriptionRegistrar } from '../../../../contexts/notifications/application/register-push-subscription/PushSubscriptionRegistrar';
import type { PushSubscriptionRemover } from '../../../../contexts/notifications/application/remove-push-subscription/PushSubscriptionRemover';
import type { NotificationsSearcher } from '../../../../contexts/notifications/application/search-notifications/NotificationsSearcher';
import type { GroupConversationInvitationNotificationResource } from '../../../../contexts/notifications/infrastructure/http/resources/GroupConversationInvitationNotificationResource';
import type { NotificationResource } from '../../../../contexts/notifications/infrastructure/http/resources/NotificationResource';

import { PigeonNotificationsFacade } from '../../../../app/composition/notifications/PigeonNotificationsFacade';
import { PushNotificationServer } from '../../../../contexts/notifications/domain/PushNotificationServer';
import { NotificationAccessContexts } from '../../../../contexts/notifications/infrastructure/http/NotificationAccessContexts';
import { NotificationMapper } from '../../../../contexts/notifications/infrastructure/http/NotificationMapper';
import { NotificationSettingMapper } from '../../../../contexts/notifications/infrastructure/http/NotificationSettingMapper';

type GroupInvitations = Pick<
  GroupConversationMailbox,
  'acceptInvitation' | 'declineInvitation' | 'invitations'
>;

const session = { identity: { id: 'identity-1' } } as unknown as Session;

const directInvitation = (id: string): NotificationResource => ({
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
  type: 'conversation_invitation',
});

const groupLetter = (
  id: string,
): GroupConversationInvitationNotificationResource => ({
  id,
  payload: {
    encryptedConversationKey: 'sealed',
    inviterIdentityId: 'identity-2',
    nonce: 'nonce-1',
    recipientIdentityId: 'identity-1',
  },
  recipientIdentityId: 'identity-1',
  state: 'pending',
  status: 'unread',
  type: 'group_conversation_invitation',
});

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
      mock<GroupInvitations>(),
    );
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
      mock<GroupInvitations>(),
    );

    await expect(facade.getPushVapidPublicKey()).resolves.toEqual({
      enabled: true,
      publicKey: 'public-key',
    });
  });

  it('lists only the group letters waiting for the user to answer', async () => {
    const useCases = mock<NotificationUseCases>();
    const searcher = mock<NotificationsSearcher>();
    const mapper = new NotificationMapper();
    const groups = mock<GroupInvitations>();
    useCases.notificationSearcher = searcher;
    searcher.search.mockResolvedValue([
      mapper.fromResource(directInvitation('direct')),
      mapper.fromResource(groupLetter('control')),
      mapper.fromResource(groupLetter('waiting')),
    ]);
    groups.invitations.mockReturnValue([
      {
        conversationId: 'group:a',
        inviterIdentityId: 'identity-2',
        notificationId: 'waiting',
        sentAt: 1,
      },
    ]);
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      mapper,
      new NotificationSettingMapper(),
      useCases,
      groups,
    );

    const listed = await facade.list(session);

    expect(listed.map(({ id }) => id)).toEqual(['direct', 'waiting']);
  });

  it('refuses to accept a group control letter as a one-to-one invitation', async () => {
    const facade = new PigeonNotificationsFacade(
      new NotificationAccessContexts(),
      new NotificationMapper(),
      new NotificationSettingMapper(),
      mock<NotificationUseCases>(),
      mock<GroupInvitations>(),
    );

    await expect(
      facade.acceptConversationInvitation(session, groupLetter('control')),
    ).rejects.toThrow('Only one-to-one invitations carry a key to accept.');
  });

  it.each([
    ['accepts', 'acceptInvitation', 'accepted'],
    ['declines', 'declineInvitation', 'declined'],
  ] as const)(
    '%s a waiting group invitation through the group mailboxes',
    async (_name, method, state) => {
      const groups = mock<GroupInvitations>();
      const facade = new PigeonNotificationsFacade(
        new NotificationAccessContexts(),
        new NotificationMapper(),
        new NotificationSettingMapper(),
        mock<NotificationUseCases>(),
        groups,
      );
      const letter = groupLetter('waiting');
      const answer = (): Promise<unknown> =>
        method === 'acceptInvitation'
          ? facade.acceptGroupInvitation(session, letter)
          : facade.declineGroupInvitation(session, letter);

      groups[method].mockResolvedValue(true);
      await expect(answer()).resolves.toEqual({ ...letter, state });
      expect(groups[method]).toHaveBeenCalledWith(session, 'waiting');

      groups[method].mockResolvedValue(false);
      await expect(answer()).rejects.toThrow(
        'The group invitation is no longer waiting.',
      );
    },
  );
});
