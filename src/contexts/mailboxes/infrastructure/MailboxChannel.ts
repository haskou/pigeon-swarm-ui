import { randomBytes } from '@noble/hashes/utils.js';

import type { MailboxKeys } from './crypto/MailboxKeySchedule';
import type { PigeonMailboxClient } from './http/PigeonMailboxClient';

import { encodeBase64Url } from '../../../shared/infrastructure/encoding/base64url';
import { MailboxCapability } from './crypto/MailboxCapability';
import { MailboxCreationProof } from './crypto/MailboxCreationProof';
import { MailboxEnvelopeCipher } from './crypto/MailboxEnvelopeCipher';
import { MailboxEnvelopeError } from './crypto/MailboxEnvelopeError';
import { MailboxCreationDifficultyError } from './http/MailboxCreationDifficultyError';
import { MailboxUnavailableError } from './http/MailboxUnavailableError';

export type MailboxCreationMiner = (
  mailboxId: string,
  postTokenHash: string,
  readTokenHash: string,
  difficultyBits: number,
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
  /**
   * True when the inbox was re-created while reading. Its cursors start
   * again from 1, so a cursor stored for the old inbox no longer applies.
   */
  recreated: boolean;
};

/**
 * Sender and recipient protocol over the node mailbox routes. Sealing, key
 * material and proof-of-work stay inside this module; callers see
 * plaintext only.
 */
export class MailboxChannel {
  private static readonly ENVELOPE_ID_BYTES = 16;
  /** Ceiling on the difficulty a creation retry will mine. */
  private static readonly MAX_CREATION_DIFFICULTY_BITS = 24;

  public constructor(
    private readonly client: PigeonMailboxClient,
    private readonly mine: MailboxCreationMiner,
  ) {}

  private async putInbox(
    mailboxId: string,
    postTokenHash: string,
    readTokenHash: string,
    difficultyBits: number,
  ): Promise<void> {
    const creationNonce = await this.mine(
      mailboxId,
      postTokenHash,
      readTokenHash,
      difficultyBits,
    );

    await this.client.create(mailboxId, {
      creationNonce,
      postTokenHash,
      readTokenHash,
    });
  }

  /**
   * Re-creates the recipient mailbox when the node reports it unavailable,
   * then retries the operation once. Only recipient routes recover: a sender
   * lacks the read-token hash needed to re-create the mailbox. `recreated`
   * tells the caller that the mailbox is new, so cursors from the old one no
   * longer apply.
   */
  private async recovering<T>(
    keys: MailboxKeys,
    readToken: string,
    operation: () => Promise<T>,
  ): Promise<{ recreated: boolean; value: T }> {
    try {
      return { recreated: false, value: await operation() };
    } catch (error: unknown) {
      if (!(error instanceof MailboxUnavailableError)) {
        throw error;
      }

      await this.createInbox(keys, readToken);

      return { recreated: true, value: await operation() };
    }
  }

  /**
   * Recipient only. Creates the inbox once, mining at the default difficulty.
   * If the node names a higher difficulty up to MAX_CREATION_DIFFICULTY_BITS,
   * re-mines once at that value. Keep the readToken to read and acknowledge.
   */
  public async createInbox(
    keys: MailboxKeys,
    readToken: string,
  ): Promise<void> {
    const postTokenHash = MailboxCapability.hash(keys.postToken);
    const readTokenHash = MailboxCapability.hash(readToken);

    try {
      await this.putInbox(
        keys.mailboxId,
        postTokenHash,
        readTokenHash,
        MailboxCreationProof.DEFAULT_DIFFICULTY_BITS,
      );
    } catch (error: unknown) {
      if (
        !(error instanceof MailboxCreationDifficultyError) ||
        error.requiredDifficultyBits <=
          MailboxCreationProof.DEFAULT_DIFFICULTY_BITS ||
        error.requiredDifficultyBits >
          MailboxChannel.MAX_CREATION_DIFFICULTY_BITS
      ) {
        throw error;
      }

      await this.putInbox(
        keys.mailboxId,
        postTokenHash,
        readTokenHash,
        error.requiredDifficultyBits,
      );
    }
  }

  /** Sender. Seals one plaintext into a fresh envelope. */
  public async send(
    keys: MailboxKeys,
    plaintext: Uint8Array,
  ): Promise<{ cursor: number; envelopeId: string }> {
    const envelopeId = encodeBase64Url(
      randomBytes(MailboxChannel.ENVELOPE_ID_BYTES),
    );
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
    const { recreated, value: page } = await this.recovering(
      keys,
      readToken,
      () => this.client.read(keys.mailboxId, readToken, after, limit),
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
      recreated,
    };
  }

  /**
   * Recipient. Removes everything up to and including `upTo`. An evicted
   * mailbox is re-created once and the acknowledgement retried. Reports
   * whether that re-creation happened.
   */
  public async acknowledge(
    keys: MailboxKeys,
    readToken: string,
    upTo: number,
  ): Promise<{ recreated: boolean }> {
    const { recreated } = await this.recovering(keys, readToken, () =>
      this.client.acknowledge(keys.mailboxId, readToken, upTo),
    );

    return { recreated };
  }
}
