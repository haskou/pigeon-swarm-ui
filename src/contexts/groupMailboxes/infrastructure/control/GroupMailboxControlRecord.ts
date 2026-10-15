import type { GroupMailboxControlFields } from './GroupMailboxControlFields';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import { DeviceCredential } from '../../../identities/domain/value-objects/DeviceCredential';
import { GroupMailboxGenesis } from '../../domain/GroupMailboxGenesis';

/**
 * Wire format of `GroupMailboxControlFields`: one JSON object with kind
 * `group-mailbox-control`, binary fields in unpadded base64url. Decoding is
 * strict and never throws: anything else is not a control record.
 */
export class GroupMailboxControlRecord {
  private static readonly ENCODED = /^[A-Za-z0-9_-]+$/;
  private static readonly KIND = 'group-mailbox-control';
  /** Keeps a sealed record inside the largest mailbox bucket (64 KiB). */
  private static readonly MAX_BINARY_BYTES = 40_000;
  private static readonly MAX_CONVERSATION_ID_LENGTH = 256;
  private static readonly REQUEST_ID = /^[A-Za-z0-9_-]{22}$/;
  private static readonly VERSION = 1;

  private static binary(value: unknown): Uint8Array | undefined {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      !GroupMailboxControlRecord.ENCODED.test(value)
    ) {
      return undefined;
    }
    const bytes = new Uint8Array(decodeBase64Url(value));

    return bytes.length <= GroupMailboxControlRecord.MAX_BINARY_BYTES &&
      encodeBase64Url(bytes) === value
      ? bytes
      : undefined;
  }

  /** A commit or an MLS application message, carried as opaque bytes. */
  private static carried(
    value: Record<string, unknown>,
    conversationId: string,
  ): GroupMailboxControlFields | null {
    if (value.type === 'commit') {
      const commit = GroupMailboxControlRecord.binary(value.commit);

      return commit ? { commit, conversationId, type: 'commit' } : null;
    }
    const ciphertext = GroupMailboxControlRecord.binary(value.ciphertext);

    return ciphertext ? { ciphertext, conversationId, type: 'message' } : null;
  }

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

  private static fromFields(
    value: Record<string, unknown>,
    conversationId: string,
  ): GroupMailboxControlFields | null {
    switch (value.type) {
      case 'key-package-request':
        return GroupMailboxControlRecord.request(value, conversationId);
      case 'key-package-response':
        return GroupMailboxControlRecord.response(value, conversationId);
      case 'welcome':
        return GroupMailboxControlRecord.welcome(value, conversationId);
      case 'commit':
      case 'message':
        return GroupMailboxControlRecord.carried(value, conversationId);
      default:
        return null;
    }
  }

  private static isIndex(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) >= 0;
  }

  private static isRequestId(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      GroupMailboxControlRecord.REQUEST_ID.test(value)
    );
  }

  private static json(value: Record<string, unknown>): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(value));
  }

  private static response(
    value: Record<string, unknown>,
    conversationId: string,
  ): GroupMailboxControlFields | null {
    const keyPackage = GroupMailboxControlRecord.binary(value.keyPackage);
    const { requestId } = value;

    return keyPackage && GroupMailboxControlRecord.isRequestId(requestId)
      ? { conversationId, keyPackage, requestId, type: 'key-package-response' }
      : null;
  }

  /**
   * A request, with the device it asks and the group's genesis when it
   * names them; null when it names either invalidly.
   */
  private static request(
    value: Record<string, unknown>,
    conversationId: string,
  ): GroupMailboxControlFields | null {
    const { deviceCredential, requestId } = value;
    const genesis =
      value.genesis === undefined
        ? undefined
        : GroupMailboxGenesis.of(conversationId, value.genesis);

    if (
      !GroupMailboxControlRecord.isRequestId(requestId) ||
      (genesis === undefined && value.genesis !== undefined)
    ) {
      return null;
    }

    try {
      return {
        conversationId,
        ...(deviceCredential === undefined
          ? {}
          : {
              deviceCredential: DeviceCredential.fromString(
                String(deviceCredential),
              ).valueOf(),
            }),
        ...(genesis === undefined ? {} : { genesis }),
        requestId,
        type: 'key-package-request',
      };
    } catch {
      return null;
    }
  }

  private static welcome(
    value: Record<string, unknown>,
    conversationId: string,
  ): GroupMailboxControlFields | null {
    const welcome = GroupMailboxControlRecord.binary(value.welcome);
    const { index } = value;

    return welcome && GroupMailboxControlRecord.isIndex(index)
      ? { conversationId, index, type: 'welcome', welcome }
      : null;
  }

  /** Null unless the plaintext is a valid control record. */
  public static decode(
    plaintext: Uint8Array,
  ): GroupMailboxControlFields | null {
    const value = GroupMailboxControlRecord.fieldsOf(plaintext);
    const { conversationId } = value;

    if (
      value.kind !== GroupMailboxControlRecord.KIND ||
      value.version !== GroupMailboxControlRecord.VERSION ||
      typeof conversationId !== 'string' ||
      conversationId === '' ||
      conversationId.length >
        GroupMailboxControlRecord.MAX_CONVERSATION_ID_LENGTH
    ) {
      return null;
    }

    return GroupMailboxControlRecord.fromFields(value, conversationId);
  }

  public static encode(fields: GroupMailboxControlFields): Uint8Array {
    const header = {
      conversationId: fields.conversationId,
      kind: GroupMailboxControlRecord.KIND,
      type: fields.type,
      version: GroupMailboxControlRecord.VERSION,
    };

    switch (fields.type) {
      case 'key-package-request':
        return GroupMailboxControlRecord.json({
          ...header,
          ...(fields.deviceCredential === undefined
            ? {}
            : { deviceCredential: fields.deviceCredential }),
          ...(fields.genesis === undefined
            ? {}
            : { genesis: fields.genesis.toPrimitives() }),
          requestId: fields.requestId,
        });
      case 'key-package-response':
        return GroupMailboxControlRecord.json({
          ...header,
          keyPackage: encodeBase64Url(fields.keyPackage),
          requestId: fields.requestId,
        });
      case 'welcome':
        return GroupMailboxControlRecord.json({
          ...header,
          index: fields.index,
          welcome: encodeBase64Url(fields.welcome),
        });
      case 'commit':
        return GroupMailboxControlRecord.json({
          ...header,
          commit: encodeBase64Url(fields.commit),
        });
      case 'message':
        return GroupMailboxControlRecord.json({
          ...header,
          ciphertext: encodeBase64Url(fields.ciphertext),
        });
    }
  }
}
