import { GroupMailboxKeyMaterial } from './GroupMailboxKeyMaterial';

/**
 * `gen_k`: the generation secret every current member holds. It is exported
 * from the MLS epoch of group creation or of the latest removal commit, so a
 * removed member never learns the next one.
 */
export class GroupMailboxGenerationSecret extends GroupMailboxKeyMaterial {
  public static fromBytes(bytes: Uint8Array): GroupMailboxGenerationSecret {
    return new GroupMailboxGenerationSecret(
      GroupMailboxKeyMaterial.encode(bytes),
    );
  }

  public static fromString(value: string): GroupMailboxGenerationSecret {
    return new GroupMailboxGenerationSecret(value);
  }

  private constructor(value: string) {
    super(value);
  }
}
