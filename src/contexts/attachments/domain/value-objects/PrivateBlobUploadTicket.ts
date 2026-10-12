export type PrivateBlobUploadTicket = {
  blobId: string;
  origin?: string;
  uploadToken: string;
};

/**
 * A ticket needs a string `blobId` and `uploadToken`. `origin` is either absent
 * (the session node) or a string; any other value is malformed.
 */
export function isPrivateBlobUploadTicket(
  value: unknown,
): value is PrivateBlobUploadTicket {
  if (typeof value !== 'object' || value === null) return false;

  const ticket = value as Record<keyof PrivateBlobUploadTicket, unknown>;

  return (
    typeof ticket.blobId === 'string' &&
    typeof ticket.uploadToken === 'string' &&
    (ticket.origin === undefined || typeof ticket.origin === 'string')
  );
}
