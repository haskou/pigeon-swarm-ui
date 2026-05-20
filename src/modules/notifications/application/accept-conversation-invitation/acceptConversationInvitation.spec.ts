import type {
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { AcceptConversationInvitationPort } from '../ports/acceptConversationInvitationPort';

import { AcceptConversationInvitation } from './acceptConversationInvitation';
import { AcceptConversationInvitationMessage } from './messages/acceptConversationInvitationMessage';

describe(AcceptConversationInvitation.name, () => {
  it('delegates invitation acceptance to the pigeon API gateway', async () => {
    const session = { password: 'secret' } as Session;
    const notification = {
      id: 'notification-1',
      state: 'pending',
    } as NotificationResource;
    const expected = {
      keychain: { conversations: {}, version: 2 } as LocalKeychain,
      keychainExternalIdentifier: 'keychain-2',
      notification: { ...notification, state: 'accepted' },
    };
    const gateway = {
      acceptConversationInvitation: jest.fn().mockResolvedValue(expected),
    } as unknown as AcceptConversationInvitationPort;
    const useCase = new AcceptConversationInvitation(gateway);

    await expect(
      useCase.accept(
        new AcceptConversationInvitationMessage({ notification, session }),
      ),
    ).resolves.toBe(expected);
    expect(gateway.acceptConversationInvitation).toHaveBeenCalledWith(
      session,
      notification,
    );
  });
});
