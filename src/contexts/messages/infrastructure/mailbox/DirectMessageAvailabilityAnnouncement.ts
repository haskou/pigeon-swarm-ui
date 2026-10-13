import { MailboxAvailabilityServers } from '../../../../shared/infrastructure/client/MailboxAvailabilityServers';

/** The availability servers a recipient holds its direct inbox on. */
export interface DirectMessageAvailabilityAnnouncementFields {
  authorId: string;
  conversationId: string;
  createdAt: number;
  servers: string[];
}

/**
 * Plaintext of the envelope in which a recipient tells its peer which
 * availability servers also hold its inbox. It travels sealed in the peer's
 * inbox like any record, is never stored in history, and a client that does
 * not know the kind skips it.
 */
export class DirectMessageAvailabilityAnnouncement {
  private static readonly KIND = 'direct-mailbox-servers';
  private static readonly VERSION = 1;

  /** The plaintext's top-level fields, or none when it is not a JSON object. */
  private static fieldsOf(plaintext: Uint8Array): Record<string, unknown> {
    try {
      const value: unknown = JSON.parse(new TextDecoder().decode(plaintext));

      return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private static isTimestamp(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
  }

  public static encode(
    fields: DirectMessageAvailabilityAnnouncementFields,
  ): Uint8Array {
    return new TextEncoder().encode(
      JSON.stringify({
        authorId: fields.authorId,
        conversationId: fields.conversationId,
        createdAt: fields.createdAt,
        kind: DirectMessageAvailabilityAnnouncement.KIND,
        servers: fields.servers,
        version: DirectMessageAvailabilityAnnouncement.VERSION,
      }),
    );
  }

  /** Null unless the plaintext is a valid announcement for the conversation. */
  public static decode(
    plaintext: Uint8Array,
    conversationId: string,
  ): DirectMessageAvailabilityAnnouncementFields | null {
    const value = DirectMessageAvailabilityAnnouncement.fieldsOf(plaintext);
    const { authorId, createdAt } = value;
    const servers = MailboxAvailabilityServers.parse(value.servers);

    if (
      value.kind !== DirectMessageAvailabilityAnnouncement.KIND ||
      value.version !== DirectMessageAvailabilityAnnouncement.VERSION ||
      value.conversationId !== conversationId ||
      typeof authorId !== 'string' ||
      authorId === '' ||
      !DirectMessageAvailabilityAnnouncement.isTimestamp(createdAt) ||
      servers === undefined
    ) {
      return null;
    }

    return { authorId, conversationId, createdAt, servers };
  }
}
