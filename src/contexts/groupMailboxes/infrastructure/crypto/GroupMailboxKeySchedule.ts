import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';

import type { IdentityId } from '../../../identities/domain/value-objects/IdentityId';

import { MailboxReadToken } from '../../../mailboxes/infrastructure/crypto/MailboxReadToken';
import { GroupMailboxEnvelopeKey } from '../../domain/value-objects/GroupMailboxEnvelopeKey';
import { GroupMailboxGenerationSecret } from '../../domain/value-objects/GroupMailboxGenerationSecret';
import { GroupMailboxId } from '../../domain/value-objects/GroupMailboxId';
import { GroupMailboxOwnerRootKey } from '../../domain/value-objects/GroupMailboxOwnerRootKey';
import { GroupMailboxPostToken } from '../../domain/value-objects/GroupMailboxPostToken';
import { GroupMailboxReadToken } from '../../domain/value-objects/GroupMailboxReadToken';
import { GroupMailboxSlot } from '../../domain/value-objects/GroupMailboxSlot';

/**
 * Key schedule of one member inbox `I(Y,k)` in a group generation
 * (node `docs/design/group-mailboxes.md`, Derivation). Mailbox id, post token
 * and envelope key come from the generation secret `gen_k` and the member slot
 * `s_Y`. The slot is `HKDF(gen_k, slot label ‖ identityId)`: only members hold
 * `gen_k`, so no outsider can map an inbox to an identity, and a removed member
 * has no slot of the next generation. The read token comes from the owner's
 * root key, so no other member can read the inbox.
 *
 * Every member must agree on this schedule byte for byte; the vectors are in
 * `src/test/fixtures/group-mailbox-derivation-vectors.json`.
 */
export class GroupMailboxKeySchedule {
  private static readonly ENVELOPE_LABEL = 'pigeon/group-mailbox/envelope/v1';
  private static readonly ID_LABEL = 'pigeon/group-mailbox/id/v1';
  private static readonly POST_LABEL = 'pigeon/group-mailbox/post/v1';
  private static readonly SLOT_LABEL = 'pigeon/group-mailbox/slot/v1';

  /**
   * HKDF-SHA256, no salt, 32 bytes, info `label ‖ s_Y`. The label is fixed per
   * purpose and the slot is fixed-length, so the encoding is unambiguous.
   */
  private static expand(
    generation: GroupMailboxGenerationSecret,
    label: string,
    slot: GroupMailboxSlot,
  ): Uint8Array {
    return hkdf(
      sha256,
      generation.getBytes(),
      undefined,
      concatBytes(new TextEncoder().encode(label), slot.getBytes()),
      32,
    );
  }

  /**
   * `s_Y = HKDF(gen_k, "pigeon/group-mailbox/slot/v1" ‖ utf8(identityId))`.
   * The label is fixed and comes first, so the variable-length identity id
   * cannot be confused with another label.
   */
  public static slot(
    generation: GroupMailboxGenerationSecret,
    identityId: IdentityId,
  ): GroupMailboxSlot {
    return GroupMailboxSlot.fromBytes(
      hkdf(
        sha256,
        generation.getBytes(),
        undefined,
        concatBytes(
          new TextEncoder().encode(GroupMailboxKeySchedule.SLOT_LABEL),
          new TextEncoder().encode(identityId.valueOf()),
        ),
        32,
      ),
    );
  }

  public static envelopeKey(
    generation: GroupMailboxGenerationSecret,
    slot: GroupMailboxSlot,
  ): GroupMailboxEnvelopeKey {
    return GroupMailboxEnvelopeKey.fromBytes(
      GroupMailboxKeySchedule.expand(
        generation,
        GroupMailboxKeySchedule.ENVELOPE_LABEL,
        slot,
      ),
    );
  }

  public static mailboxId(
    generation: GroupMailboxGenerationSecret,
    slot: GroupMailboxSlot,
  ): GroupMailboxId {
    return GroupMailboxId.fromBytes(
      GroupMailboxKeySchedule.expand(
        generation,
        GroupMailboxKeySchedule.ID_LABEL,
        slot,
      ),
    );
  }

  public static postToken(
    generation: GroupMailboxGenerationSecret,
    slot: GroupMailboxSlot,
  ): GroupMailboxPostToken {
    return GroupMailboxPostToken.fromBytes(
      GroupMailboxKeySchedule.expand(
        generation,
        GroupMailboxKeySchedule.POST_LABEL,
        slot,
      ),
    );
  }

  /**
   * `HKDF(rootKey_Y, "pigeon/mailbox/read/v1" ‖ mailboxId)`: the one-to-one
   * read token derivation, applied to the group inbox id.
   */
  public static readToken(
    ownerRootKey: GroupMailboxOwnerRootKey,
    mailboxId: GroupMailboxId,
  ): GroupMailboxReadToken {
    return GroupMailboxReadToken.fromString(
      MailboxReadToken.derive(ownerRootKey.getBytes(), mailboxId.valueOf()),
    );
  }
}
