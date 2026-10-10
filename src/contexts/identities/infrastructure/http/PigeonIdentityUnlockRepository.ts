import type { Identity } from '../../domain/Identity';
import type { IdentityUnlockRepository } from '../../domain/repositories/IdentityUnlockRepository';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { DeviceIdentityVault } from '../storage/DeviceIdentityVault';
import type { IdentityAccessContexts } from './IdentityAccessContexts';
import type { IdentityMapper } from './IdentityMapper';
import type { PigeonIdentitiesGateway } from './PigeonIdentitiesGateway';

// eslint-disable-next-line max-len
export class PigeonIdentityUnlockRepository implements IdentityUnlockRepository {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly contexts: IdentityAccessContexts,
    private readonly mapper: IdentityMapper,
    private readonly vault: DeviceIdentityVault,
  ) {}

  public async forget(identityId: IdentityId): Promise<void> {
    await this.vault.delete(identityId);
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
    );

    this.contexts.register(session);

    return this.mapper.fromResource(session.identity);
  }
}
