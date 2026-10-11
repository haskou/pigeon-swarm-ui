export type PrivateBlobReservation = {
  blobId: string;
  downloadToken: string;
  expiresAt: number;
  uploadToken: string;
};

/** Capability for one encrypted part. Stored only inside encrypted payloads. */
export type PrivateBlobReference = {
  blobId: string;
  downloadToken: string;
  expiresAt: number;
  index: number;
  size: number;
};
