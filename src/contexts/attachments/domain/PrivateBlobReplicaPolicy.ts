import { PrivateBlobPartHasNoReplicaError } from './errors/PrivateBlobPartHasNoReplicaError';

/**
 * Replica rules for private blobs. Infrastructure supplies canonical origins
 * and stored replicas; these rules decide which origins are planned, which
 * replica is the primary and which are alternates, and when every part of a
 * message is stored.
 */
export class PrivateBlobReplicaPolicy {
  private static readonly maximumOrigins = 3;
  private static readonly maximumAlternates = 2;

  /**
   * Distinct origins to replicate to, in candidate order, capped. `undefined`
   * candidates are dropped; callers list the sender's home before the
   * recipient's home.
   */
  public static plannedOrigins(candidates: (string | undefined)[]): string[] {
    const origins = candidates.filter(
      (origin): origin is string => origin !== undefined,
    );

    return [...new Set(origins)].slice(
      0,
      PrivateBlobReplicaPolicy.maximumOrigins,
    );
  }

  /** A message is storable only when every part has at least one replica. */
  public static everyPartStored(
    parts: readonly (readonly unknown[])[],
  ): boolean {
    return parts.every((replicas) => replicas.length > 0);
  }

  /**
   * The first replica is the primary. Other replicas that name an origin are
   * alternates, in stored order, capped. A part without any replica is an
   * error.
   */
  public static split<T extends { origin?: string }>(
    replicas: readonly T[],
  ): { alternates: (T & { origin: string })[]; primary: T } {
    const [primary, ...others] = replicas;

    if (!primary) {
      throw new PrivateBlobPartHasNoReplicaError();
    }

    return {
      alternates: others
        .filter(
          (replica): replica is T & { origin: string } =>
            replica.origin !== undefined,
        )
        .slice(0, PrivateBlobReplicaPolicy.maximumAlternates),
      primary,
    };
  }
}
