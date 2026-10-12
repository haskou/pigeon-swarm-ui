import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type {
  MailboxAppend,
  MailboxChannel,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { RecipientMailboxAttempt } from '../../domain/RecipientMailboxAttempt';

import { MailboxUnavailableError } from '../../../mailboxes/infrastructure/http/MailboxUnavailableError';
import { RecipientMailboxRoutingPolicy } from '../../domain/RecipientMailboxRoutingPolicy';

/**
 * Appends to the recipient's verified mailbox home base, falling back to the
 * local node when no home is published or the home cannot be reached. This
 * class performs the I/O and classifies each outcome; the fallback and rethrow
 * rule lives in RecipientMailboxRoutingPolicy.
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

  /** Logs a count-only line per home fault. A 404 is an absent inbox. */
  private async attemptHome(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<RecipientMailboxAttempt<MailboxAppend>> {
    let base: string | undefined;

    try {
      base = await this.verifiedHome(recipientIdentityId);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Recipient mailbox home lookup failed; local node used.');

      return { error, kind: 'faulted' };
    }

    if (base === undefined) return { kind: 'absent' };

    try {
      return {
        kind: 'delivered',
        value: await this.createChannel(base).send(keys, plaintext),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Recipient mailbox append failed; local node used.');

      return error instanceof MailboxUnavailableError
        ? { error, kind: 'absent' }
        : { error, kind: 'faulted' };
    }
  }

  private async attemptLocal(
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<RecipientMailboxAttempt<MailboxAppend>> {
    try {
      return {
        kind: 'delivered',
        value: await this.local.send(keys, plaintext),
      };
    } catch (error) {
      return error instanceof MailboxUnavailableError
        ? { error, kind: 'absent' }
        : { error, kind: 'faulted' };
    }
  }

  public async send(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<MailboxAppend> {
    const home = await this.attemptHome(recipientIdentityId, keys, plaintext);

    if (home.kind === 'delivered') return home.value;

    return RecipientMailboxRoutingPolicy.resolve(
      home,
      await this.attemptLocal(keys, plaintext),
    );
  }
}
