import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/**
 * Owner-only read, acknowledge and delete capability for one inbox. The node
 * stores only its hash.
 */
export class GroupMailboxReadToken extends GroupMailboxKeyMaterial {
  public static fromBytes(bytes: Uint8Array): GroupMailboxReadToken {
    return new GroupMailboxReadToken(GroupMailboxKeyMaterial.encode(bytes));
  }

  public static fromString(value: string): GroupMailboxReadToken {
    return new GroupMailboxReadToken(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
