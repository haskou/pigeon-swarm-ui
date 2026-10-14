import type { GroupConversationMailbox } from '../../../groupMailboxes/infrastructure/GroupConversationMailbox';
import type { DirectMessageMailbox } from '../../../messages/infrastructure/mailbox/DirectMessageMailbox';
import type { DeviceMailboxRepository } from '../../domain/repositories/DeviceMailboxRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityAccessContexts } from '../http/IdentityAccessContexts';

/**
 * This device's direct-mailbox readers, history and outbox; its group
 * conversations and the MLS state of its communities.
 */
export class MailboxDeviceRepository implements DeviceMailboxRepository {
  public constructor(
    private readonly contexts: IdentityAccessContexts,
    private readonly mailbox: DirectMessageMailbox,
    private readonly groups: Pick<GroupConversationMailbox, 'forget'>,
    private readonly communities: { forget(identityId: string): Promise<void> },
  ) {}

  public async cancelOutbox(identityId: IdentityId): Promise<void> {
    await this.mailbox.cancelOutbox(identityId.toString());
  }

  /** Tries both; rejects when either could not be deleted. */
  public async forgetGroups(identityId: IdentityId): Promise<void> {
    const results = await Promise.allSettled([
      this.groups.forget(identityId.toString()),
      this.communities.forget(identityId.toString()),
    ]);

    if (results.some(({ status }) => status === 'rejected')) {
      throw new Error('Group state could not be deleted.');
    }
  }

  public async forgetHistory(identityId: IdentityId): Promise<void> {
    await this.mailbox.forgetHistory(identityId.toString());
  }

  public async releaseReaders(identityId: IdentityId): Promise<void> {
    await this.mailbox.releaseDeviceReaders(
      this.contexts.find(identityId).session,
    );
  }
}
