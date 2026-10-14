import type { PrivateBlobPartStorePort } from './PrivateBlobPartStorePort';

import { PrivateBlobUploadIncompleteError } from '../errors/PrivateBlobUploadIncompleteError';
import { PrivateBlobReplicaPolicy } from '../PrivateBlobReplicaPolicy';

/**
 * Stores a private blob message all or nothing. Every part is stored in
 * parallel. When PrivateBlobReplicaPolicy finds a part without a replica, the
 * replicas already stored are abandoned and the upload is incomplete.
 */
export class PrivateBlobReplicationDomainService {
  public static async storeParts<Replica>(
    port: PrivateBlobPartStorePort<Replica>,
    count: number,
  ): Promise<Replica[][]> {
    const stored = await Promise.all(
      Array.from({ length: count }, (_, index) => port.storePart(index)),
    );

    if (!PrivateBlobReplicaPolicy.everyPartStored(stored)) {
      await port.abandon(stored.flat());
      throw new PrivateBlobUploadIncompleteError();
    }

    return stored;
  }
}
