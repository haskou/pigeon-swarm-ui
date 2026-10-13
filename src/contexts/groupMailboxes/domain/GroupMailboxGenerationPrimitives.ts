/** Stored form of a `GroupMailboxGeneration`. */
export interface GroupMailboxGenerationPrimitives {
  readonly index: number;
  readonly secret: string;
  /** The MLS epoch whose exporter produced the secret. */
  readonly epoch: string;
  /** Digest of the leaves of that epoch's tree. */
  readonly tree: string;
  /** When a membership change superseded it; absent while current. */
  readonly retiredAt?: number;
}
