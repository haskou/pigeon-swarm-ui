import type {
  LocalKeychain,
  NotificationResource,
  Session,
} from '../../domain/types';
import type { PigeonApiGateway } from '../../infrastructure/pigeon-api/PigeonApiGateway';

import { AcceptInvitation } from './AcceptConversationInvitation';

describe(AcceptInvitation.name, () => {
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
    } as unknown as PigeonApiGateway;
    const useCase = new AcceptInvitation(gateway);

    await expect(useCase.execute(session, notification)).resolves.toBe(
      expected,
    );
    expect(gateway.acceptConversationInvitation).toHaveBeenCalledWith(
      session,
      notification,
    );
  });
});
