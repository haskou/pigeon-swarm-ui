import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

import type { MailboxKeys } from './crypto/MailboxKeySchedule';
import type {
  MailboxReaderSet,
  PigeonMailboxClient,
} from './http/PigeonMailboxClient';

import { encodeBase64Url } from '../../../shared/infrastructure/encoding/base64url';
import { MailboxUnavailableError } from '../domain/errors/MailboxUnavailableError';
import { MailboxCreationDomainService } from '../domain/services/MailboxCreationDomainService';
import { MailboxCapability } from './crypto/MailboxCapability';
import { MailboxCreationProof } from './crypto/MailboxCreationProof';
import { MailboxEnvelopeCipher } from './crypto/MailboxEnvelopeCipher';
import { MailboxEnvelopeError } from './crypto/MailboxEnvelopeError';

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

  /** Creations in flight, keyed by mailbox and read-token hash. */
  private readonly pendingCreations = new Map<string, Promise<void>>();

  /**
   * A stable envelope id for one send to one inbox. Seeded, so a resend of the
   * same send posts the id the node already holds.
   */
  public static envelopeIdFor(seed: string): string {
    return encodeBase64Url(
      sha256(new TextEncoder().encode(seed)).subarray(
        0,
        MailboxChannel.ENVELOPE_ID_BYTES,
      ),
    );
  }

  /** A fresh envelope id, for a send that is not resent under a seed. */
  public static randomEnvelopeId(): string {
    return encodeBase64Url(randomBytes(MailboxChannel.ENVELOPE_ID_BYTES));
  }

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
   * Recipient only. Creates the inbox once; MailboxCreationDomainService
   * negotiates the difficulty. Keep the root token, which manages readers.
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

    await MailboxCreationDomainService.create(
      {
        createWithDifficulty: (difficultyBits) =>
          this.putInbox(
            keys.mailboxId,
            postTokenHash,
            readTokenHash,
            difficultyBits,
          ),
      },
      MailboxCreationProof.DEFAULT_DIFFICULTY_BITS,
    );
  }

  /** Sender. Seals one plaintext under `envelopeId`, a fresh id by default. */
  public async send(
    keys: MailboxKeys,
    plaintext: Uint8Array,
    envelopeId: string = MailboxChannel.randomEnvelopeId(),
  ): Promise<MailboxAppend> {
    const body = await MailboxEnvelopeCipher.seal(
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
    const opened = await Promise.all(
      page.envelopes.map(({ body, cursor, envelopeId }) =>
        MailboxEnvelopeCipher.open(
          keys.envelopeKey,
          keys.mailboxId,
          envelopeId,
          body,
        ).then(
          (plaintext): OpenedMailboxEnvelope => ({
            cursor,
            envelopeId,
            plaintext,
          }),
          (error: unknown) => {
            if (error instanceof MailboxEnvelopeError) return null;
            throw error;
          },
        ),
      ),
    );
    const envelopes = opened.filter((envelope) => envelope !== null);

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

  /** Deletes the inbox and its envelopes; any read token of it may. */
  public async deleteInbox(
    keys: MailboxKeys,
    readToken: string,
  ): Promise<void> {
    await this.client.delete(keys.mailboxId, readToken);
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
