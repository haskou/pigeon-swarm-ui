import type { Session } from '../../../identities/infrastructure/session/Session';
import type {
  MailboxChannel,
  MailboxReadTokens,
} from '../../../mailboxes/infrastructure/MailboxChannel';
import type { DirectMessageHistoryItem } from './DirectMessageHistoryItem';
import type { DirectMessageHistoryStore } from './DirectMessageHistoryStore';

import { MailboxEnvelopeCipher } from '../../../mailboxes/infrastructure/crypto/MailboxEnvelopeCipher';
import { MailboxKeySchedule } from '../../../mailboxes/infrastructure/crypto/MailboxKeySchedule';
import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { DirectMessageRecordReader } from './DirectMessageRecordReader';

const EPOCH = 0;
const PAGE_LIMIT = 100;
const PREFIX_BYTES = 2;
/** Sealed envelope bytes exported in total, summed over bucket sizes. */
const MAX_SEALED_BYTES = 4 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Frames one record as u16be id length, conversation id, plaintext. */
function frame({
  conversationId,
  plaintext,
}: DirectMessageHistoryItem): Uint8Array {
  const id = encoder.encode(conversationId);
  const framed = new Uint8Array(
    PREFIX_BYTES + id.byteLength + plaintext.byteLength,
  );
  const view = new DataView(framed.buffer);

  view.setUint16(0, id.byteLength);
  framed.set(id, PREFIX_BYTES);
  framed.set(plaintext, PREFIX_BYTES + id.byteLength);

  return framed;
}

/** Inverse of `frame`. Undefined when the frame is truncated. */
function unframe(framed: Uint8Array): DirectMessageHistoryItem | undefined {
  if (framed.byteLength < PREFIX_BYTES) return undefined;

  const view = new DataView(
    framed.buffer,
    framed.byteOffset,
    framed.byteLength,
  );
  const end = PREFIX_BYTES + view.getUint16(0);

  if (framed.byteLength < end) return undefined;

  return {
    conversationId: decoder.decode(framed.subarray(PREFIX_BYTES, end)),
    plaintext: framed.subarray(end),
  };
}

/**
 * Newest-first items that fit the budget, framed and returned oldest first.
 * Items whose frame exceeds one envelope are skipped; the rest keep the budget.
 */
function withinBudget(
  items: readonly DirectMessageHistoryItem[],
): Uint8Array[] {
  const selected: Uint8Array[] = [];
  let sealedBytes = 0;

  for (const item of items) {
    const framed = frame(item);

    if (framed.byteLength > MailboxEnvelopeCipher.MAX_PLAINTEXT_BYTES) continue;

    const bytes = MailboxEnvelopeCipher.bucketFor(framed.byteLength);

    if (sealedBytes + bytes > MAX_SEALED_BYTES) continue;

    sealedBytes += bytes;
    selected.push(framed);
  }

  return selected.reverse();
}

/**
 * Pairing history export. The authorizing device posts its newest direct
 * history into a one-shot mailbox derived from a secret that travels only in
 * the encrypted pairing completion. The node sees mailbox ids and token
 * hashes, never record plaintext or the secret. Each record is one envelope,
 * sent oldest first so the importer keeps chronological order.
 */
export class DirectMessageHistoryTransfer {
  /** Most records exported; the newest are kept. */
  public static readonly MAX_RECORDS = 500;

  public constructor(
    private readonly channel: MailboxChannel,
    private readonly history: DirectMessageHistoryStore,
  ) {}

  /** Stores one framed record when this identity's root authored it. */
  private async importRecord(
    session: Session,
    framed: Uint8Array,
  ): Promise<void> {
    const item = unframe(framed);

    if (!item) return;

    const record = DirectMessageRecordReader.decode(
      session,
      item.conversationId,
      item.plaintext,
    );

    if (!record) return;

    await this.history.append(session, item.conversationId, [
      { plaintext: item.plaintext, recordId: record.id },
    ]);
  }

  /**
   * Exporter. Publishes this identity's newest history to the transfer mailbox
   * derived from `secret`. A failure stops the publish and leaves the transfer
   * partial or absent; the importer then gets what was sent. Never throws.
   */
  public async publish(session: Session, secret: Uint8Array): Promise<void> {
    try {
      const keys = MailboxKeySchedule.derive(
        secret,
        session.identity.id,
        EPOCH,
      );
      const readToken = MailboxReadToken.derive(secret, keys.mailboxId);
      const items = await this.history.recent(
        session,
        DirectMessageHistoryTransfer.MAX_RECORDS,
      );
      const frames = withinBudget(items);

      await this.channel.createInbox(keys, readToken);

      for (const framed of frames) {
        await this.channel.send(keys, framed);
      }
    } catch {
      console.debug('Direct history transfer publish failed.');
    }
  }

  /**
   * Importer. Reads the transfer mailbox from its start, imports every record
   * this identity's root authored, and acks each page. Re-running is safe:
   * records already held collapse by record id. Never throws.
   */
  public async receive(session: Session, secret: Uint8Array): Promise<void> {
    try {
      const keys = MailboxKeySchedule.derive(
        secret,
        session.identity.id,
        EPOCH,
      );
      const readToken = MailboxReadToken.derive(secret, keys.mailboxId);
      const readers: MailboxReadTokens = { device: readToken, root: readToken };
      let after = 0;
      let page = await this.channel.read(keys, readers, after, PAGE_LIMIT);

      while (page.lastCursor > after) {
        for (const envelope of page.envelopes) {
          await this.importRecord(session, envelope.plaintext);
        }

        await this.channel.acknowledge(keys, readers, page.lastCursor);
        after = page.lastCursor;

        if (!page.hasMore) break;

        page = await this.channel.read(keys, readers, after, PAGE_LIMIT);
      }
    } catch {
      console.debug('Direct history transfer receive failed.');
    }
  }
}
