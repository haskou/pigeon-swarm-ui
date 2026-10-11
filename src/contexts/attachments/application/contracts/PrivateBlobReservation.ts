export type PrivateBlobReservation = {
  blobId: string;
  downloadToken: string;
  expiresAt: number;
  uploadToken: string;
};
