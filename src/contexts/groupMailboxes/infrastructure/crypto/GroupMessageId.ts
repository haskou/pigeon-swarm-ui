import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';

/**
 * Id of a group record, bound to its author: `<nonce>.<tag>`, the tag
 * hashing the author's identity id with the nonce. A member can only make
 * ids of its own, so no one takes the id of another member's message, as
 * a message, an edit or a reaction. Both parts are 16 bytes in canonical
 * unpadded base64url.
 */
export class GroupMessageId {
  private static readonly BYTES = 16;
  private static readonly LABEL = 'pigeon-group-message-id';
  private static readonly SHAPE = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{22})$/;

  private static tag(authorId: string, nonce: string): string {
    return encodeBase64Url(
      sha256(
        new TextEncoder().encode(
          [GroupMessageId.LABEL, authorId, nonce].join('\u0000'),
        ),
      ).slice(0, GroupMessageId.BYTES),
    );
  }

  /** Whether `id` is an id `authorId` made. */
  public static belongsTo(id: string, authorId: string): boolean {
    const parts = GroupMessageId.SHAPE.exec(id);

    if (!parts) return false;
    const [, nonce, tag] = parts;

    return GroupMessageId.tag(authorId, nonce) === tag;
  }

  /** A fresh id of `authorId`. */
  public static create(authorId: string): string {
    const nonce = encodeBase64Url(randomBytes(GroupMessageId.BYTES));

    return `${nonce}.${GroupMessageId.tag(authorId, nonce)}`;
  }
}
