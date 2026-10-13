import { mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DirectMessageMailbox } from '../../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityAccessContexts } from '../../../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import { MailboxDeviceRepository } from '../../../../../contexts/identities/infrastructure/mailbox/MailboxDeviceRepository';

const session = { identity: { id: 'identity-a' } } as unknown as Session;
const identityId = IdentityId.fromString('identity-a');

describe(MailboxDeviceRepository.name, () => {
  it('releases the readers of the registered session', async () => {
    const contexts = new IdentityAccessContexts();
    const mailbox = mock<DirectMessageMailbox>();

    contexts.register(session);

    await new MailboxDeviceRepository(contexts, mailbox).releaseReaders(
      identityId,
    );

    expect(mailbox.releaseDeviceReaders).toHaveBeenCalledWith(session);
  });

  it('forgets the local direct history of the identity', async () => {
    const mailbox = mock<DirectMessageMailbox>();

    await new MailboxDeviceRepository(
      new IdentityAccessContexts(),
      mailbox,
    ).forgetHistory(identityId);

    expect(mailbox.forgetHistory).toHaveBeenCalledWith('identity-a');
  });

  it('cancels the queued direct sends of the identity', async () => {
    const mailbox = mock<DirectMessageMailbox>();

    await new MailboxDeviceRepository(
      new IdentityAccessContexts(),
      mailbox,
    ).cancelOutbox(identityId);

    expect(mailbox.cancelOutbox).toHaveBeenCalledWith('identity-a');
  });
});
