import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/**
 * AES-256-GCM key of the outer per-copy AEAD (decision D5): random nonce per
 * copy, AAD the mailbox id. Every member of the generation can derive it.
 */
export class GroupMailboxEnvelopeKey extends GroupMailboxKeyMaterial {
  public static fromBytes(bytes: Uint8Array): GroupMailboxEnvelopeKey {
    return new GroupMailboxEnvelopeKey(GroupMailboxKeyMaterial.encode(bytes));
  }

  public static fromString(value: string): GroupMailboxEnvelopeKey {
    return new GroupMailboxEnvelopeKey(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
