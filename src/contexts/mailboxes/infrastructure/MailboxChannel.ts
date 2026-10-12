import { randomBytes } from '@noble/hashes/utils.js';

import type { MailboxKeys } from './crypto/MailboxKeySchedule';
import type {
  MailboxReaderSet,
  PigeonMailboxClient,
} from './http/PigeonMailboxClient';

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

/**
 * Recipient read capabilities for one inbox. `device` is this device's
 * reader: it reads and acknowledges. `root` is the first reader and the only
 * one that manages the reader set; every acknowledgement is mirrored to it.
 */
export type MailboxReadTokens = {
  device: string;
  root: string;
};

export type OpenedMailboxEnvelope = {
  cursor: number;
  envelopeId: string;
  plaintext: Uint8Array;
};

/** Acknowledged append: the relay's cursor and the envelope id it stored. */
export type MailboxAppend = { cursor: number; envelopeId: string };

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

  /** Creations in flight, keyed by mailbox and read-token hash. */
  private readonly pendingCreations = new Map<string, Promise<void>>();

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
   * with the root reader, re-enrols the device reader, then retries the
   * operation once. Only recipient routes recover: a sender lacks the root
   * token needed to re-create the mailbox. `recreated` tells the caller that
   * the mailbox is new, so cursors from the old one no longer apply.
   */
  private async recovering<T>(
    keys: MailboxKeys,
    readers: MailboxReadTokens,
    operation: () => Promise<T>,
  ): Promise<{ recreated: boolean; value: T }> {
    try {
      return { recreated: false, value: await operation() };
    } catch (error: unknown) {
      if (!(error instanceof MailboxUnavailableError)) {
        throw error;
      }

      await this.createInbox(keys, readers.root);
      await this.addReader(keys, readers.root, readers.device);

      return { recreated: true, value: await operation() };
    }
  }

  /**
   * Recipient only. Creates the inbox once, mining at the default difficulty.
   * If the node names a higher difficulty up to MAX_CREATION_DIFFICULTY_BITS,
   * re-mines once at that value. Keep the root token, which manages readers.
   * Overlapping calls for the same inbox and token share one creation: a
   * second pass can see the inbox as missing while the first is still
   * creating it.
   */
  public createInbox(keys: MailboxKeys, readToken: string): Promise<void> {
    const readTokenHash = MailboxCapability.hash(readToken);
    const flightKey = `${keys.mailboxId}|${readTokenHash}`;
    const inFlight = this.pendingCreations.get(flightKey);

    if (inFlight) {
      return inFlight;
    }

    const creation = this.createInboxOnce(keys, readTokenHash).finally(() => {
      this.pendingCreations.delete(flightKey);
    });
    this.pendingCreations.set(flightKey, creation);

    return creation;
  }

  private async createInboxOnce(
    keys: MailboxKeys,
    readTokenHash: string,
  ): Promise<void> {
    const postTokenHash = MailboxCapability.hash(keys.postToken);

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
  ): Promise<MailboxAppend> {
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
    readers: MailboxReadTokens,
    after: number,
    limit: number,
  ): Promise<OpenedMailboxPage> {
    const { recreated, value: page } = await this.recovering(
      keys,
      readers,
      () => this.client.read(keys.mailboxId, readers.device, after, limit),
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
   * Recipient. Acknowledges through the device reader, then mirrors the same
   * cursor to the root reader so envelopes wait for every reader. An evicted
   * mailbox is re-created once and the acknowledgement retried. Reports
   * whether that re-creation happened.
   */
  public async acknowledge(
    keys: MailboxKeys,
    readers: MailboxReadTokens,
    upTo: number,
  ): Promise<{ recreated: boolean }> {
    const { recreated } = await this.recovering(keys, readers, async () => {
      await this.client.acknowledge(keys.mailboxId, readers.device, upTo);
      await this.client.acknowledge(keys.mailboxId, readers.root, upTo);
    });

    return { recreated };
  }

  /** Lists the inbox's readers. The root token authorises the call. */
  public listReaders(
    keys: MailboxKeys,
    rootToken: string,
  ): Promise<MailboxReaderSet> {
    return this.client.readers(keys.mailboxId, rootToken);
  }

  /** Enrols a reader by its token hash, authorised by the root token. */
  public async addReader(
    keys: MailboxKeys,
    rootToken: string,
    readerToken: string,
  ): Promise<void> {
    await this.client.addReader(
      keys.mailboxId,
      rootToken,
      MailboxCapability.hash(readerToken),
    );
  }

  /** Removes a reader by hash. The node refuses to drop the last reader. */
  public async removeReader(
    keys: MailboxKeys,
    rootToken: string,
    readerTokenHash: string,
  ): Promise<void> {
    await this.client.removeReader(keys.mailboxId, rootToken, readerTokenHash);
  }
}
