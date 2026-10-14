import { EncryptedPayload, Signature } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { GroupMailboxControlLetter } from './GroupMailboxControlLetter';

import { canonicalJson } from '../../../../shared/infrastructure/crypto/canonicalJson';
import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';

/**
 * Seals a control record to one peer (node `docs/design/group-mailboxes.md`,
 * D8): signed by the sender's identity key, bound to sender, recipient,
 * conversation and send time, then encrypted to the recipient's identity
 * key. Opening is strict and never throws: a letter that is not for this
 * identity, not signed by the expected sender or not bound to the expected
 * conversation opens to nothing.
 */
export class GroupMailboxControlSeal {
  private static readonly DOMAIN = 'pigeon:group-mailbox-control-letter:v1\n';
  private static readonly KIND = 'group-mailbox-control-letter';

  private static letterOf(
    session: Session,
    sealed: string,
  ): Record<string, unknown> | undefined {
    try {
      const value: unknown = JSON.parse(
        session.keyPair.decrypt(new EncryptedPayload(sealed)).toString(),
      );

      return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private static signed(
    letter: Omit<GroupMailboxControlLetter, 'signature'>,
  ): string {
    return `${GroupMailboxControlSeal.DOMAIN}${canonicalJson({
      conversationId: letter.conversationId,
      kind: letter.kind,
      payload: letter.payload,
      recipientIdentityId: letter.recipientIdentityId,
      senderIdentityId: letter.senderIdentityId,
      sentAt: letter.sentAt,
    })}`;
  }

  private static signedBy(
    letter: GroupMailboxControlLetter,
    senderIdentityId: string,
  ): boolean {
    try {
      return IdentityId.fromString(senderIdentityId)
        .getPublicKey()
        .isValidSignature(
          GroupMailboxControlSeal.signed(letter),
          new Signature(letter.signature),
        );
    } catch {
      return false;
    }
  }

  /** `value` has the letter's shape and binds the expected parties. */
  private static boundTo(
    value: Record<string, unknown>,
    expected: Pick<
      GroupMailboxControlLetter,
      'conversationId' | 'recipientIdentityId' | 'senderIdentityId'
    >,
  ): value is GroupMailboxControlLetter {
    return (
      value.kind === GroupMailboxControlSeal.KIND &&
      value.conversationId === expected.conversationId &&
      value.recipientIdentityId === expected.recipientIdentityId &&
      value.senderIdentityId === expected.senderIdentityId &&
      typeof value.payload === 'string' &&
      typeof value.signature === 'string' &&
      Number.isSafeInteger(value.sentAt)
    );
  }

  /** The record and send time, if `sealed` is a valid letter to `session`. */
  public static open(
    session: Session,
    sealed: string,
    expected: { conversationId: string; senderIdentityId: string },
  ): { plaintext: Uint8Array; sentAt: number } | undefined {
    const value = GroupMailboxControlSeal.letterOf(session, sealed);
    const senderIdentityId = IdentityId.normalize(expected.senderIdentityId);
    const bound =
      value &&
      GroupMailboxControlSeal.boundTo(value, {
        conversationId: expected.conversationId,
        recipientIdentityId: IdentityId.normalize(session.identity.id),
        senderIdentityId,
      });

    if (!bound || !GroupMailboxControlSeal.signedBy(value, senderIdentityId)) {
      return undefined;
    }

    return {
      plaintext: new Uint8Array(decodeBase64Url(value.payload)),
      sentAt: value.sentAt,
    };
  }

  /** `plaintext` signed by `session` and encrypted to its recipient. */
  public static seal(
    session: Session,
    input: {
      conversationId: string;
      plaintext: Uint8Array;
      recipientIdentityId: string;
      sentAt: number;
    },
  ): string {
    const recipientIdentityId = IdentityId.normalize(input.recipientIdentityId);
    const unsigned = {
      conversationId: input.conversationId,
      kind: 'group-mailbox-control-letter' as const,
      payload: encodeBase64Url(input.plaintext),
      recipientIdentityId,
      senderIdentityId: IdentityId.normalize(session.identity.id),
      sentAt: input.sentAt,
    };
    const signature = session.keyPair
      .sign(GroupMailboxControlSeal.signed(unsigned))
      .toString();

    return IdentityId.fromString(recipientIdentityId)
      .getPublicKey()
      .encrypt(JSON.stringify({ ...unsigned, signature }))
      .toString();
  }
}
