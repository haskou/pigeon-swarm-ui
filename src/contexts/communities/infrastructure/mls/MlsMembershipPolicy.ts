/** A commit's effect on membership, by identity. */
export interface MlsMembershipChange {
  /** The identity whose leaf made the commit. */
  readonly committer: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/**
 * Who may hold a leaf and who may change membership. It must be answered
 * from the roster the node keeps, never from the MLS tree itself.
 */
export interface MlsMembershipPolicy {
  /** Whether the identity may hold a leaf. */
  admits(identityId: string): boolean;
  /** Whether the committer may make this change. */
  allows(change: MlsMembershipChange): boolean;
}
