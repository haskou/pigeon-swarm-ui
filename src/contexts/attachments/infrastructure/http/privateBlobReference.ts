import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type { PrivateBlobReference } from '../../application/contracts/PrivateBlobReservation';
import type { StoredPrivateBlobReplica } from './PrivateBlobReplicator';
import type { PrivateBlobUploadRef } from './PrivateBlobUploadLedger';

import { PrivateBlobReplicaPolicy } from '../../domain/PrivateBlobReplicaPolicy';

/**
 * The first replica is the primary. Other replicas that name an origin become
 * alternates, in stored order, up to the domain's alternate cap.
 */
export function toPrivateBlobReference(
  index: number,
  size: number,
  replicas: StoredPrivateBlobReplica[],
): PrivateBlobReference {
  const { alternates, primary } = PrivateBlobReplicaPolicy.split(replicas);

  return {
    blobId: primary.blobId,
    downloadToken: primary.downloadToken,
    expiresAt: primary.expiresAt,
    index,
    ...(primary.origin ? { origin: primary.origin } : {}),
    ...(alternates.length > 0
      ? {
          alternates: alternates.map(({ blobId, downloadToken, origin }) => ({
            blobId,
            downloadToken,
            origin,
          })),
        }
      : {}),
    size,
  };
}

/**
 * Every stored blob of the attachments and their previews: primaries and
 * alternates.
 */
export function privateBlobRefsOf(
  attachments: MessageAttachment[],
): PrivateBlobUploadRef[] {
  return attachments.flatMap((attachment) =>
    [attachment, attachment.preview].flatMap((owner) =>
      (owner?.blobs ?? []).flatMap((blob) => [
        blob.origin
          ? { blobId: blob.blobId, origin: blob.origin }
          : { blobId: blob.blobId },
        ...(blob.alternates ?? []).map(({ blobId, origin }) => ({
          blobId,
          origin,
        })),
      ]),
    ),
  );
}
