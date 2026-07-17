import type { Identity } from '../../domain/Identity';
import type { IdentityUnlockRepository } from '../../domain/repositories/IdentityUnlockRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { IdentityAccessContexts } from './IdentityAccessContexts';
import type { IdentityMapper } from './IdentityMapper';
import type { PigeonIdentitiesGateway } from './PigeonIdentitiesGateway';

// eslint-disable-next-line max-len
export class PigeonIdentityUnlockRepository implements IdentityUnlockRepository {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly contexts: IdentityAccessContexts,
    private readonly mapper: IdentityMapper,
  ) {}

  public async restore(identityId: IdentityId): Promise<Identity> {
    const session = await this.gateway.restoreSession(
      identityId.toString(),
      this.contexts.reportProgress(identityId),
    );

    this.contexts.register(session);

    return this.mapper.fromResource(session.identity);
  }

  public async unlock(
    identityId: IdentityId,
    protection: IdentityMasterKeyProtection,
  ): Promise<Identity> {
    const factors = protection.toPrimitives();
    const session = await this.gateway.unlockSession(
      identityId.toString(),
      factors.password,
      this.contexts.reportProgress(identityId),
      factors.recoveryKey,
    );

    this.contexts.register(session);

    return this.mapper.fromResource(session.identity);
  }
}
