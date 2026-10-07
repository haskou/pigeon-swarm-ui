import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { AuthorizationRevisionSource } from '../../../../shared/infrastructure/crypto/AuthorizationRevisionSource';
import type { PigeonDeviceAuthorizationApi } from './PigeonDeviceAuthorizationApi';

import { IdentityId } from '../../domain/value-objects/IdentityId';

const CACHE_TTL_MS = 5000;

interface Entry {
  expiresAt: number;
  revision: Promise<number>;
}

/**
 * Reads the identity's device authorization revision from the node
 * (`GET /identity-devices/{identityId}`, the current checkpoint). One read is
 * shared by the signing calls of a short window; a failed read is never
 * cached. The result is never lower than the revision at which this device was
 * itself enrolled, which the session carries.
 */
// eslint-disable-next-line max-len
export class DeviceAuthorizationRevisionSource implements AuthorizationRevisionSource {
  private readonly entries = new Map<string, Entry>();

  public constructor(
    private readonly authorization: Pick<PigeonDeviceAuthorizationApi, 'find'>,
    private readonly clock: () => number = () => Date.now(),
    private readonly ttlMs: number = CACHE_TTL_MS,
  ) {}

  private key(session: Session): string {
    return `${IdentityId.normalize(session.identity.id)}:${
      session.deviceCredentialKeyPair.toPrimitives().publicKey
    }`;
  }

  public async current(session: Session): Promise<number> {
    const key = this.key(session);
    const cached = this.entries.get(key);
    const floor = session.authorizationRevision.valueOf();
    let revision: Promise<number>;

    if (cached && cached.expiresAt > this.clock()) {
      revision = cached.revision;
    } else {
      revision = this.authorization
        .find(session)
        .then((checkpoint) => checkpoint.getRevision().valueOf());
      this.entries.set(key, {
        expiresAt: this.clock() + this.ttlMs,
        revision,
      });
      revision.catch(() => {
        if (this.entries.get(key)?.revision === revision) {
          this.entries.delete(key);
        }
      });
    }

    return Math.max(await revision, floor);
  }
}
