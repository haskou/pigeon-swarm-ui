import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type {
  MailboxAppend,
  MailboxChannel,
} from '../../../mailboxes/infrastructure/MailboxChannel';

/**
 * Appends to the recipient's verified mailbox home, falling back to the local
 * node when no home is published or the home cannot be reached.
 */
export class RecipientMailboxRouter {
  public constructor(
    private readonly local: Pick<MailboxChannel, 'send'>,
    private readonly verifiedHome: (
      identityId: string,
    ) => Promise<string | undefined>,
    private readonly createChannel: (
      origin: string,
    ) => Pick<MailboxChannel, 'send'>,
  ) {}

  /**
   * A failed lookup means no verified home, so the local node takes the
   * message.
   */
  private async homeOf(identityId: string): Promise<string | undefined> {
    try {
      return await this.verifiedHome(identityId);
    } catch {
      return undefined;
    }
  }

  public async send(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<MailboxAppend> {
    const origin = await this.homeOf(recipientIdentityId);

    if (origin !== undefined) {
      try {
        return await this.createChannel(origin).send(keys, plaintext);
      } catch {
        // Home unreachable: the local node keeps the message deliverable.
      }
    }

    return await this.local.send(keys, plaintext);
  }
}
