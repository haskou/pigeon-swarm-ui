import type { MailboxKeys } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import type { MailboxAppend } from '../../../mailboxes/infrastructure/MailboxChannel';
import type { RecipientMailboxAttempt } from '../../domain/RecipientMailboxAttempt';

import { MailboxChannel } from '../../../mailboxes/infrastructure/MailboxChannel';
import { RecipientMailboxRoutingPolicy } from '../../domain/RecipientMailboxRoutingPolicy';

/**
 * Appends to the recipient's verified mailbox home base, falling back to the
 * local node when no home is published or the home cannot be reached. This
 * class performs the I/O; RecipientMailboxRoutingPolicy classifies each
 * failure and owns the fallback and rethrow rule.
 *
 * The same envelope also goes to every availability server the recipient
 * announced, in parallel. The send lands when any server takes it, so a down
 * home does not lose the message; the recipient dedupes by record id.
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

  /** Logs a count-only line per home fault. */
  private async attemptHome(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
    envelopeId: string,
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
        value: await this.createChannel(base).send(keys, plaintext, envelopeId),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Recipient mailbox append failed; local node used.');

      return RecipientMailboxRoutingPolicy.failed(error);
    }
  }

  private async attemptLocal(
    keys: MailboxKeys,
    plaintext: Uint8Array,
    envelopeId: string,
  ): Promise<RecipientMailboxAttempt<MailboxAppend>> {
    try {
      return {
        kind: 'delivered',
        value: await this.local.send(keys, plaintext, envelopeId),
      };
    } catch (error) {
      return RecipientMailboxRoutingPolicy.failed(error);
    }
  }

  /** Home, then local node, as RecipientMailboxRoutingPolicy decides. */
  private async sendPrimary(
    recipientIdentityId: string,
    keys: MailboxKeys,
    plaintext: Uint8Array,
    envelopeId: string,
  ): Promise<MailboxAppend> {
    const home = await this.attemptHome(
      recipientIdentityId,
      keys,
      plaintext,
      envelopeId,
    );

    if (home.kind === 'delivered') return home.value;

    return RecipientMailboxRoutingPolicy.resolve(
      home,
      await this.attemptLocal(keys, plaintext, envelopeId),
    );
  }

  /**
   * Appends to the primary route and to each availability server under one
   * envelope id. Resolves the primary append, else the first availability
   * append that landed. Throws the primary error only when none landed, so a
   * 404 still reads as an absent inbox. Logs a count-only line per failed
   * availability server.
   */
  public async send(
    recipientIdentityId: string,
    servers: readonly string[],
    keys: MailboxKeys,
    plaintext: Uint8Array,
    envelopeId: string = MailboxChannel.randomEnvelopeId(),
  ): Promise<MailboxAppend> {
    const [primary, ...extras] = await Promise.allSettled([
      this.sendPrimary(recipientIdentityId, keys, plaintext, envelopeId),
      ...servers.map(
        async (base) =>
          await this.createChannel(base).send(keys, plaintext, envelopeId),
      ),
    ]);

    for (const extra of extras) {
      if (extra.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.debug('Availability mailbox append failed.');
      }
    }

    if (primary.status === 'fulfilled') return primary.value;

    const landed = extras.find(
      (extra): extra is PromiseFulfilledResult<MailboxAppend> =>
        extra.status === 'fulfilled',
    );

    if (landed) return landed.value;

    throw primary.reason;
  }
}
