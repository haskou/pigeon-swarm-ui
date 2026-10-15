import type { MlsContextExtension } from '../../../communities/infrastructure/mls/MlsContextExtension';
import type { GroupMailboxRosterFields } from '../../domain/GroupMailboxRosterFields';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';
import { GroupMailboxRoster } from '../../domain/GroupMailboxRoster';

const KEYS = [
  'adminIds',
  'conversationId',
  'creatorId',
  'memberIds',
  'name',
  'version',
].join(',');
/** Larger than any roster `GroupMailboxRoster.of` accepts. */
const MAX_BYTES = 1_048_576;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * The roster of a group conversation as a GroupContext extension: the
 * canonical JSON (RFC 8785) of its fields, both lists sorted. Every member
 * agrees on the GroupContext, so every member judges a commit by the same
 * roster. Decoding is strict: the bytes must be exactly the encoding of a
 * well-formed roster.
 */
export class GroupMailboxRosterExtension {
  /** A private-use extension type (RFC 9420, section 17.3). */
  public static readonly EXTENSION_TYPE = 0xf421;

  /** The JSON text of `bytes` and its value, or undefined if not JSON. */
  private static parsed(
    bytes: Uint8Array,
  ): { text: string; value: unknown } | undefined {
    if (bytes.length > MAX_BYTES) return undefined;

    try {
      const text = decoder.decode(bytes);

      return { text, value: JSON.parse(text) };
    } catch {
      return undefined;
    }
  }

  /** Whether `value` is an object holding exactly the roster keys. */
  private static keyed(
    value: unknown,
  ): value is Partial<Record<keyof GroupMailboxRosterFields, unknown>> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).sort().join(',') === KEYS
    );
  }

  private static typed(
    fields: Partial<Record<keyof GroupMailboxRosterFields, unknown>>,
  ): fields is GroupMailboxRosterFields {
    return (
      Array.isArray(fields.adminIds) &&
      Array.isArray(fields.memberIds) &&
      typeof fields.conversationId === 'string' &&
      typeof fields.creatorId === 'string' &&
      typeof fields.name === 'string' &&
      typeof fields.version === 'number'
    );
  }

  public static encode(roster: GroupMailboxRoster): Uint8Array {
    return encoder.encode(canonicalJson(roster.toFields()));
  }

  /** The roster the bytes encode, or undefined when they are not one. */
  public static decode(bytes: Uint8Array): GroupMailboxRoster | undefined {
    const parsed = GroupMailboxRosterExtension.parsed(bytes);
    const value = parsed?.value;

    if (
      !GroupMailboxRosterExtension.keyed(value) ||
      !GroupMailboxRosterExtension.typed(value)
    ) {
      return undefined;
    }
    const { adminIds, conversationId, creatorId, memberIds, name, version } =
      value;
    const roster = GroupMailboxRoster.of({
      adminIds,
      conversationId,
      creatorId,
      memberIds,
      name,
      version,
    });

    return roster && canonicalJson(roster.toFields()) === parsed!.text
      ? roster
      : undefined;
  }

  /**
   * The roster of a GroupContext holding exactly the roster extension;
   * undefined for any other context.
   */
  public static read(
    extensions: readonly MlsContextExtension[],
  ): GroupMailboxRoster | undefined {
    const [extension] = extensions;

    return extensions.length === 1 &&
      extension.extensionType === GroupMailboxRosterExtension.EXTENSION_TYPE
      ? GroupMailboxRosterExtension.decode(extension.extensionData)
      : undefined;
  }
}
