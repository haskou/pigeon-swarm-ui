import { IdentityId } from './value-objects/IdentityId';

/**
 * Compares identity ids through the IdentityId value object, so the same
 * identity in PEM and bare form is one identity. Ids come from the network
 * too: an id the value object rejects is not the same identity.
 */
export class IdentityMatch {
  public static isSame(
    candidate: string | undefined,
    identityId: string,
  ): boolean {
    if (candidate === undefined) return false;

    try {
      return IdentityId.fromString(candidate).isEqual(
        IdentityId.fromString(identityId),
      );
    } catch {
      return false;
    }
  }
}
