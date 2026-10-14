/** Stores the parts of one private blob message as replicas. */
export interface PrivateBlobPartStorePort<Replica> {
  /** Removes replicas already stored. Never rejects. */
  abandon(replicas: Replica[]): Promise<void>;
  /** Stores one part on every planned origin; resolves with the ones stored. */
  storePart(index: number): Promise<Replica[]>;
}
