/** Stored form of a `GroupMailboxGeneration`. */
export interface GroupMailboxGenerationPrimitives {
  readonly index: number;
  readonly secret: string;
  /** The MLS epoch whose exporter produced the secret. */
  readonly epoch: string;
  /** When a removal superseded this generation; absent while current. */
  readonly retiredAt?: number;
}
