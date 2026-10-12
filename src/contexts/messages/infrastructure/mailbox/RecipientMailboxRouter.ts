import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type {
  MailboxAppend,
  MailboxChannel,
} from '../../../mailboxes/infrastructure/MailboxChannel';

/**
 * Appends to the recipient's verified mailbox home base, falling back to the
 * local node when no home is published or the home cannot be reached.
 */
export class RecipientMailboxRouter {
  public constructor(
    private readonly local: Pick<MailboxChannel, 'send'>,
    private readonly verifiedHome: (
      identityId: string,
    ) => Promise<string | undefined>,
    private readonly createChannel: (
      base: string,
    ) => Pick<MailboxChannel, 'send'>,
  ) {}

  /**
   * A failed lookup means no verified home, so the local node takes the
   * message. Logs a count-only line: no identity, URL or topic.
   */
  private async homeOf(identityId: string): Promise<string | undefined> {
    try {
      return await this.verifiedHome(identityId);
    } catch {
      // eslint-disable-next-line no-console
      console.debug('Recipient mailbox home lookup failed; local node used.');

      return undefined;
    }
  }

  public async send(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<MailboxAppend> {
    const base = await this.homeOf(recipientIdentityId);

    if (base !== undefined) {
      try {
        return await this.createChannel(base).send(keys, plaintext);
      } catch {
        // eslint-disable-next-line no-console
        console.debug('Recipient mailbox append failed; local node used.');
      }
    }

    return await this.local.send(keys, plaintext);
  }
}
