import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ConversationDraftPlainPayload } from './ConversationDraftPlainPayload';

import { encodeBase64Url } from '../../../../shared/infrastructure/encoding/base64url';
import { sessionRootKey } from '../../../identities/infrastructure/session/sessionRootKey';

/**
 * Conversation drafts sync through the node under an opaque key,
 * `base64url(HMAC-SHA256(K_draft, utf8(conversationId)))`, where `K_draft` is
 * an HKDF of the device-sealed root only the owner's devices hold. The node
 * never learns which conversation a draft belongs to.
 *
 * The payload seals the conversation id next to the content, bound to the
 * draft key as associated data; a draft opens only when it decrypts under that
 * key and its conversation derives the same key.
 */
export class ConversationDraftCipher {
  private static readonly KEY_LABEL = 'pigeon/conversation-draft-key/v1';
  private static readonly PAYLOAD_LABEL = 'pigeon/conversation-draft/v1';

  /** Null for a draft that does not open under the key it is stored as. */
  public decrypt(
    session: Session,
    draftKey: string,
    encryptedPayload: string,
  ): ConversationDraftPlainPayload | null {
    try {
      const parsed = JSON.parse(
        sessionRootKey(session)
          .decrypt(new EncryptedPayload(encryptedPayload), {
            aad: `${ConversationDraftCipher.PAYLOAD_LABEL}:${draftKey}`,
          })
          .toString(),
      ) as Partial<ConversationDraftPlainPayload>;

      if (
        typeof parsed.content !== 'string' ||
        typeof parsed.conversationId !== 'string' ||
        this.draftKey(session, parsed.conversationId) !== draftKey
      ) {
        return null;
      }

      return { content: parsed.content, conversationId: parsed.conversationId };
    } catch {
      return null;
    }
  }

  public draftKey(session: Session, conversationId: string): string {
    const draftRoot = hkdf(
      sha256,
      sessionRootKey(session).getBuffer(),
      undefined,
      new TextEncoder().encode(ConversationDraftCipher.KEY_LABEL),
      32,
    );

    return encodeBase64Url(
      hmac(sha256, draftRoot, new TextEncoder().encode(conversationId)),
    );
  }

  public encrypt(
    session: Session,
    conversationId: string,
    content: string,
  ): string {
    const payload: ConversationDraftPlainPayload = { content, conversationId };

    return sessionRootKey(session)
      .encrypt(JSON.stringify(payload), {
        aad: `${ConversationDraftCipher.PAYLOAD_LABEL}:${this.draftKey(session, conversationId)}`,
      })
      .toString();
  }
}
