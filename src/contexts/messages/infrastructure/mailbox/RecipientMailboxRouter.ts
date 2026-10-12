import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type {
  MailboxAppend,
  MailboxChannel,
} from '../../../mailboxes/infrastructure/MailboxChannel';

import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';

/**
 * Appends to the recipient's verified mailbox home base, falling back to the
 * local node when no home is published or the home cannot be reached.
 *
 * A home fault (a failed lookup, or a failed append that is not a 404) is
 * kept. If the local node then answers 404, the fault is rethrown: the caller
 * must not read a real delivery failure as a benign missing inbox.
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
   * Appends to the verified home. Resolves to undefined when no home is
   * published or the home answers 404, which is benign. Any other home fault
   * throws, so the caller can keep it. Logs a count-only line per fault.
   */
  private async appendHome(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<MailboxAppend | undefined> {
    let base: string | undefined;

    try {
      base = await this.verifiedHome(recipientIdentityId);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Recipient mailbox home lookup failed; local node used.');

      throw error;
    }

    if (base === undefined) return undefined;

    try {
      return await this.createChannel(base).send(keys, plaintext);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Recipient mailbox append failed; local node used.');

      if (error instanceof MailboxUnavailableError) return undefined;

      throw error;
    }
  }

  public async send(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<MailboxAppend> {
    let fault: { error: unknown } | undefined;

    try {
      const appended = await this.appendHome(
        recipientIdentityId,
        keys,
        plaintext,
      );

      if (appended !== undefined) return appended;
    } catch (error) {
      fault = { error };
    }

    try {
      return await this.local.send(keys, plaintext);
    } catch (error) {
      if (fault !== undefined && error instanceof MailboxUnavailableError) {
        throw fault.error;
      }

      throw error;
    }
  }
}
