import type { DirectMessageMailbox } from '../../../messages/infrastructure/mailbox/DirectMessageMailbox';
import type { DeviceMailboxRepository } from '../../domain/repositories/DeviceMailboxRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityAccessContexts } from '../http/IdentityAccessContexts';

/** This device's direct-mailbox readers, history and outbox. */
export class MailboxDeviceRepository implements DeviceMailboxRepository {
  public constructor(
    private readonly contexts: IdentityAccessContexts,
    private readonly mailbox: DirectMessageMailbox,
  ) {}

  public async cancelOutbox(identityId: IdentityId): Promise<void> {
    await this.mailbox.cancelOutbox(identityId.toString());
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
