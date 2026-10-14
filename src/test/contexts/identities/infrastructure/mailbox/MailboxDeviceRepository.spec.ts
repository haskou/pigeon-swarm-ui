import { mock } from 'jest-mock-extended';

import type { GroupConversationMailbox } from '../../../../../contexts/groupMailboxes/infrastructure/GroupConversationMailbox';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { MailboxDeviceRepository } from '../../../../../contexts/identities/infrastructure/mailbox/MailboxDeviceRepository';

const session = { identity: { id: 'identity-a' } } as unknown as Session;
const identityId = IdentityId.fromString('identity-a');

type GroupForget = Pick<GroupConversationMailbox, 'forget'>;
type CommunityForget = { forget(identityId: string): Promise<void> };

describe(MailboxDeviceRepository.name, () => {
  it('releases the readers of the registered session', async () => {
    const contexts = new IdentityAccessContexts();
    const mailbox = mock<DirectMessageMailbox>();

    contexts.register(session);

    await new MailboxDeviceRepository(
      contexts,
      mailbox,
      mock<GroupForget>(),
      mock<CommunityForget>(),
    ).releaseReaders(identityId);

    expect(mailbox.releaseDeviceReaders).toHaveBeenCalledWith(session);
  });

  it('forgets the local direct history of the identity', async () => {
    const mailbox = mock<DirectMessageMailbox>();

    await new MailboxDeviceRepository(
      new IdentityAccessContexts(),
      mailbox,
      mock<GroupForget>(),
      mock<CommunityForget>(),
    ).forgetHistory(identityId);

    expect(mailbox.forgetHistory).toHaveBeenCalledWith('identity-a');
  });

  it('cancels the queued direct sends of the identity', async () => {
    const mailbox = mock<DirectMessageMailbox>();

    await new MailboxDeviceRepository(
      new IdentityAccessContexts(),
      mailbox,
      mock<GroupForget>(),
      mock<CommunityForget>(),
    ).cancelOutbox(identityId);

    expect(mailbox.cancelOutbox).toHaveBeenCalledWith('identity-a');
  });

  it('forgets the local group state and community MLS state of the identity', async () => {
    const groups = mock<GroupForget>();
    const communities = mock<CommunityForget>();

    await new MailboxDeviceRepository(
      new IdentityAccessContexts(),
      mock<DirectMessageMailbox>(),
      groups,
      communities,
    ).forgetGroups(identityId);

    expect(groups.forget).toHaveBeenCalledWith('identity-a');
    expect(communities.forget).toHaveBeenCalledWith('identity-a');
  });

  it('still forgets the community MLS state, then rejects, when the group state cannot be deleted', async () => {
    const groups = mock<GroupForget>();
    const communities = mock<CommunityForget>();

    groups.forget.mockRejectedValue(new Error('storage'));

    await expect(
      new MailboxDeviceRepository(
        new IdentityAccessContexts(),
        mock<DirectMessageMailbox>(),
        groups,
        communities,
      ).forgetGroups(identityId),
    ).rejects.toThrow('Group state could not be deleted.');

    expect(communities.forget).toHaveBeenCalledWith('identity-a');
  });
});
