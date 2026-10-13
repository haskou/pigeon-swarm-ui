import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/** Opaque id of one member inbox for one generation, as the node sees it. */
export class GroupMailboxId extends GroupMailboxKeyMaterial {
  public static fromBytes(bytes: Uint8Array): GroupMailboxId {
    return new GroupMailboxId(GroupMailboxKeyMaterial.encode(bytes));
  }

  public static fromString(value: string): GroupMailboxId {
    return new GroupMailboxId(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
