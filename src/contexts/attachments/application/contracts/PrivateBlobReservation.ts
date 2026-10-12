export type PrivateBlobReservation = {
  blobId: string;
  downloadToken: string;
  expiresAt: number;
  uploadToken: string;
  /** Canonical base of the node that holds the blob. Set by the client. */
  origin?: string;
};

/** Capability for one encrypted part. Stored only inside encrypted payloads. */
export type PrivateBlobReference = {
  blobId: string;
  downloadToken: string;
  expiresAt: number;
  index: number;
  /**
   * Canonical base of the node that holds this part. Absent on legacy
   * references, which read from the session node.
   */
  origin?: string;
  size: number;
};
