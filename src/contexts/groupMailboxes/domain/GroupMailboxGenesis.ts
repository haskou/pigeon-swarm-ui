import type { GroupMailboxGenesisFields } from './GroupMailboxGenesisFields';

import { ConversationIdFactory } from '../../conversations/domain/ConversationIdFactory';
import { ConversationGroupNonce } from '../../conversations/domain/value-objects/ConversationGroupNonce';
import { ConversationNetworkId } from '../../conversations/domain/value-objects/ConversationNetworkId';
import { ConversationParticipantId } from '../../conversations/domain/value-objects/ConversationParticipantId';

/**
 * The preimage of a group conversation id: `group:` + base64url(sha256 of
 * {creatorIdentityId, networkId, nonce}). It names the creator by the id
 * alone, so neither a welcomer nor the node can name another one.
 */
export class GroupMailboxGenesis {
  private static readonly MAX_FIELD_LENGTH = 1024;

  /** A string already in the form its value object keeps; else undefined. */
  private static field(value: unknown): string | undefined {
    return typeof value === 'string' &&
      value !== '' &&
      value.length <= GroupMailboxGenesis.MAX_FIELD_LENGTH &&
      value.trim() === value
      ? value
      : undefined;
  }

  /** The three fields of `value`, each in its kept form; else undefined. */
  private static fieldsOf(
    value: unknown,
  ): GroupMailboxGenesisFields | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const record: Record<string, unknown> = { ...value };
    const creatorIdentityId = GroupMailboxGenesis.field(
      record.creatorIdentityId,
    );
    const networkId = GroupMailboxGenesis.field(record.networkId);
    const nonce = GroupMailboxGenesis.field(record.nonce);

    return creatorIdentityId === undefined ||
      networkId === undefined ||
      nonce === undefined
      ? undefined
      : { creatorIdentityId, networkId, nonce };
  }

  /**
   * The genesis `value` holds when it derives `conversationId` exactly;
   * undefined for anything else. Never throws.
   */
  public static of(
    conversationId: string,
    value: unknown,
  ): GroupMailboxGenesis | undefined {
    const fields = GroupMailboxGenesis.fieldsOf(value);

    if (fields === undefined) return undefined;
    const { creatorIdentityId, networkId, nonce } = fields;

    try {
      const creator = ConversationParticipantId.fromString(creatorIdentityId);
      const derived = new ConversationIdFactory().createGroup(
        creator,
        ConversationNetworkId.fromString(networkId),
        ConversationGroupNonce.fromString(nonce),
      );

      return creator.toString() === creatorIdentityId &&
        derived.toString() === conversationId
        ? new GroupMailboxGenesis(conversationId, fields)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private constructor(
    public readonly conversationId: string,
    private readonly fields: GroupMailboxGenesisFields,
  ) {}

  public get creatorIdentityId(): string {
    return this.fields.creatorIdentityId;
  }

  public toPrimitives(): GroupMailboxGenesisFields {
    return { ...this.fields };
  }
}
