import type { MessageAttachment } from '../../application/contracts/MessageAttachment';
import type {
  PrivateBlobAlternate,
  PrivateBlobReference,
} from '../../application/contracts/PrivateBlobReservation';
import type { StoredPrivateBlobReplica } from './PrivateBlobReplicator';
import type { PrivateBlobUploadRef } from './PrivateBlobUploadLedger';

const maxAlternates = 2;

/**
 * The first replica is the primary. Other replicas that name an origin become
 * alternates, in stored order, up to `maxAlternates`.
 */
export function toPrivateBlobReference(
  index: number,
  size: number,
  replicas: StoredPrivateBlobReplica[],
): PrivateBlobReference {
  const [primary, ...others] = replicas;

  if (!primary) {
    throw new Error('Private blob part has no stored replica');
  }

  const alternates: PrivateBlobAlternate[] = others
    .flatMap((replica) =>
      replica.origin === undefined
        ? []
        : [
            {
              blobId: replica.blobId,
              downloadToken: replica.downloadToken,
              origin: replica.origin,
            },
          ],
    )
    .slice(0, maxAlternates);

  return {
    blobId: primary.blobId,
    downloadToken: primary.downloadToken,
    expiresAt: primary.expiresAt,
    index,
    ...(primary.origin ? { origin: primary.origin } : {}),
    ...(alternates.length > 0 ? { alternates } : {}),
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
