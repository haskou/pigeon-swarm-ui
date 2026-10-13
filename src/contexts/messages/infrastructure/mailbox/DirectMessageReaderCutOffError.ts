/**
 * After a revoke rotated the sealed root, an inbox the rotated root cannot
 * reach still answers the root it replaced, so a revoked device may keep
 * reading records written after the revoke.
 */
export class DirectMessageReaderCutOffError extends Error {
  public constructor() {
    super('A revoked reader still reads a direct inbox');
    this.name = DirectMessageReaderCutOffError.name;
  }
}
