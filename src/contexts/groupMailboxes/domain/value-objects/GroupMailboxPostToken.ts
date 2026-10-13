import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/**
 * Append capability for one member inbox. Every member of the generation can
 * derive it; the node stores only its hash.
 */
export class GroupMailboxPostToken extends GroupMailboxKeyMaterial {
  public static fromBytes(bytes: Uint8Array): GroupMailboxPostToken {
    return new GroupMailboxPostToken(GroupMailboxKeyMaterial.encode(bytes));
  }

  public static fromString(value: string): GroupMailboxPostToken {
    return new GroupMailboxPostToken(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
