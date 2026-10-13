import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/**
 * `rootKey_Y`: the user root key of the identity that owns an inbox. Only that
 * identity's devices hold it, so only they can derive the read token.
 */
export class GroupMailboxOwnerRootKey extends GroupMailboxKeyMaterial {
  public static fromBytes(bytes: Uint8Array): GroupMailboxOwnerRootKey {
    return new GroupMailboxOwnerRootKey(GroupMailboxKeyMaterial.encode(bytes));
  }

  public static fromString(value: string): GroupMailboxOwnerRootKey {
    return new GroupMailboxOwnerRootKey(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
