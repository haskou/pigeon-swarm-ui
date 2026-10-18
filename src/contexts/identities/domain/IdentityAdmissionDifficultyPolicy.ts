/**
 * Proof-of-work for publishing an identity. A busy node may refuse a proof
 * and name a higher difficulty; the client re-mines at that value at most
 * `maximumRetries` times, only above the default and within its ceiling.
 */
export class IdentityAdmissionDifficultyPolicy {
  /** The protocol minimum a node accepts without naming a higher difficulty. */
  public static readonly DEFAULT_DIFFICULTY_BITS = 16;
  private static readonly maximumBits = 24;
  public static readonly maximumRetries = 2;

  /** Whether retry number `retry` (1-based) may re-mine at `requiredBits`. */
  public static allowsRetry(
    defaultBits: number,
    requiredBits: number,
    retry: number,
  ): boolean {
    return (
      retry <= IdentityAdmissionDifficultyPolicy.maximumRetries &&
      requiredBits > defaultBits &&
      requiredBits <= IdentityAdmissionDifficultyPolicy.maximumBits
    );
  }
}
