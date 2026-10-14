import type { PresenceSharing } from '../../domain/PresenceSharing';

import { ConversationId } from '../../../conversations/domain/value-objects/ConversationId';
import { ContactPresence } from '../../domain/ContactPresence';

/**
 * The plaintext of one presence update, sealed by the mailbox channel. It
 * names the author and the conversation, so an update replayed into another
 * inbox or written by anyone but the contact is dropped, and carries nothing
 * about nodes or networks. Decoding is strict: any other field, kind or
 * version drops the record.
 */
export class ContactPresenceRecord {
  private static readonly KIND = 'contact-presence';
  private static readonly VERSION = 1;

  /** The type of each field; `kind` and `version` are fixed values. */
  private static readonly TYPES: Record<string, 'number' | 'string'> = {
    authorId: 'string',
    conversationId: 'string',
    expiresAt: 'number',
    kind: 'string',
    sentAt: 'number',
    sequence: 'number',
    source: 'string',
    status: 'string',
    version: 'number',
  };

  private static isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** Exactly the record's fields, each typed, of this kind and version. */
  private static isRecord(value: unknown): value is Parameters<
    typeof ContactPresence.fromPrimitives
  >[0] & {
    conversationId: string;
  } {
    if (!ContactPresenceRecord.isObject(value)) return false;

    const fields = new Map<string, unknown>(Object.entries(value));
    const types = Object.entries(ContactPresenceRecord.TYPES);

    return (
      fields.size === types.length &&
      types.every(([key, type]) => typeof fields.get(key) === type) &&
      fields.get('kind') === ContactPresenceRecord.KIND &&
      fields.get('version') === ContactPresenceRecord.VERSION
    );
  }

  /**
   * The update a contact sent through `sharing`, the receiver's sharing with
   * that contact, or null when it is not one.
   */
  public static decode(
    plaintext: Uint8Array,
    sharing: PresenceSharing,
  ): ContactPresence | null {
    try {
      const record: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(plaintext),
      );

      if (
        !ContactPresenceRecord.isRecord(record) ||
        !sharing.isFor(ConversationId.fromString(record.conversationId))
      ) {
        return null;
      }

      const presence = ContactPresence.fromPrimitives(record);

      return presence.isFrom(sharing.getContactId()) ? presence : null;
    } catch {
      return null;
    }
  }

  /** The update for the contact of `sharing`, the sender's sharing. */
  public static encode(
    sharing: PresenceSharing,
    presence: ContactPresence,
  ): Uint8Array {
    return new TextEncoder().encode(
      JSON.stringify({
        ...presence.toPrimitives(),
        conversationId: sharing.toPrimitives().conversationId,
        kind: ContactPresenceRecord.KIND,
        version: ContactPresenceRecord.VERSION,
      }),
    );
  }
}
