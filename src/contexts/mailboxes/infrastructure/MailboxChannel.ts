import { randomBytes } from '@noble/hashes/utils.js';
import { Buffer } from 'buffer';

import type { MailboxKeys } from './crypto/MailboxKeySchedule';
import type { PigeonMailboxClient } from './http/PigeonMailboxClient';

import { MailboxCapability } from './crypto/MailboxCapability';
import { MailboxEnvelopeCipher } from './crypto/MailboxEnvelopeCipher';
import { MailboxEnvelopeError } from './crypto/MailboxEnvelopeError';

export type MailboxCreationMiner = (
  mailboxId: string,
  postTokenHash: string,
  readTokenHash: string,
) => Promise<string>;

export type OpenedMailboxEnvelope = {
  cursor: number;
  envelopeId: string;
  plaintext: Uint8Array;
};

export type OpenedMailboxPage = {
  envelopes: OpenedMailboxEnvelope[];
  hasMore: boolean;
  /**
   * Highest cursor in the page, including dropped envelopes. Acknowledge
   * this value.
   */
  lastCursor: number;
};

/**
 * Sender and recipient protocol over the node mailbox routes. Sealing, key
 * material and proof-of-work stay inside this module; callers see
 * plaintext only.
 */
export class MailboxChannel {
  private static readonly ENVELOPE_ID_BYTES = 16;

  public constructor(
    private readonly client: PigeonMailboxClient,
    private readonly mine: MailboxCreationMiner,
  ) {}

  /**
   * Recipient only. Creates the inbox once. Keep the readToken to read and
   * acknowledge.
   */
  public async createInbox(
    keys: MailboxKeys,
    readToken: string,
  ): Promise<void> {
    const postTokenHash = MailboxCapability.hash(keys.postToken);
    const readTokenHash = MailboxCapability.hash(readToken);
    const creationNonce = await this.mine(
      keys.mailboxId,
      postTokenHash,
      readTokenHash,
    );

    await this.client.create(keys.mailboxId, {
      creationNonce,
      postTokenHash,
      readTokenHash,
    });
  }

  /** Sender. Seals one plaintext into a fresh envelope. */
  public async send(
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<{ cursor: number; envelopeId: string }> {
    const envelopeId = Buffer.from(
      randomBytes(MailboxChannel.ENVELOPE_ID_BYTES),
    ).toString('base64url');
    const body = MailboxEnvelopeCipher.seal(
      keys.envelopeKey,
      keys.mailboxId,
      envelopeId,
      plaintext,
    );
    const { cursor } = await this.client.append(
      keys.mailboxId,
      keys.postToken,
      {
        body,
        envelopeId,
      },
    );

    return { cursor, envelopeId };
  }

  /**
   * Recipient. Opens one page; envelopes that fail authentication are dropped
   * without being reported.
   */
  public async read(
    keys: MailboxKeys,
    readToken: string,
    after: number,
    limit: number,
  ): Promise<OpenedMailboxPage> {
    const page = await this.client.read(
      keys.mailboxId,
      readToken,
      after,
      limit,
    );
    const envelopes: OpenedMailboxEnvelope[] = [];

    for (const { body, cursor, envelopeId } of page.envelopes) {
      try {
        envelopes.push({
          cursor,
          envelopeId,
          plaintext: MailboxEnvelopeCipher.open(
            keys.envelopeKey,
            keys.mailboxId,
            envelopeId,
            body,
          ),
        });
      } catch (error: unknown) {
        if (!(error instanceof MailboxEnvelopeError)) {
          throw error;
        }
      }
    }

    return {
      envelopes,
      hasMore: page.hasMore,
      lastCursor: page.envelopes.reduce(
        (highest, envelope) => Math.max(highest, envelope.cursor),
        after,
      ),
    };
  }

  /** Recipient. Removes everything up to and including `upTo`. */
  public async acknowledge(
    mailboxId: string,
    readToken: string,
    upTo: number,
  ): Promise<void> {
    await this.client.acknowledge(mailboxId, readToken, upTo);
  }
}
