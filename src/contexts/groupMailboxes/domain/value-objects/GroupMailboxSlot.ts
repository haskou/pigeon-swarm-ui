import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/**
 * `s_Y`: 32 random bytes a member chooses when it joins and carries in its MLS
 * leaf. It scopes the member's inbox, so inbox ids never depend on an identity
 * or a group id.
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
