/**
 * Proof-of-work for creating an inbox. The node may name a difficulty above
 * the default; the client re-mines once at that value only when it sits above
 * the default and within the ceiling this client accepts.
 */
export class MailboxCreationDifficultyPolicy {
  private static readonly maximumBits = 24;

  /** Whether a node-named difficulty is one the client re-mines at. */
  public static allowsRaisedDifficulty(
    defaultBits: number,
    requiredBits: number,
  ): boolean {
    return (
      requiredBits > defaultBits &&
      requiredBits <= MailboxCreationDifficultyPolicy.maximumBits
    );
  }
}
