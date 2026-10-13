import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/**
 * `s_Y`: 32 bytes that scope a member's inbox in one generation. Derived from
 * `gen_k` and the member's identity id (`GroupMailboxKeySchedule.slot`), so
 * only members of the generation can compute it and inbox ids cannot be linked
 * to an identity or a group from outside.
 */
export class GroupMailboxSlot extends GroupMailboxKeyMaterial {
  public static fromBytes(bytes: Uint8Array): GroupMailboxSlot {
    return new GroupMailboxSlot(GroupMailboxKeyMaterial.encode(bytes));
  }

  public static fromString(value: string): GroupMailboxSlot {
    return new GroupMailboxSlot(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
