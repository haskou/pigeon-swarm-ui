import type { Identity } from '../../domain/Identity';
import type { IdentityRepository } from '../../domain/repositories/IdentityRepository';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { IdentityCreationMaterials } from '../crypto/IdentityCreationMaterials';
import type { PigeonIdentitiesGateway } from './PigeonIdentitiesGateway';

import { IdentityId } from '../../domain/value-objects/IdentityId';
import { IdentityAccessContexts } from './IdentityAccessContexts';
import { IdentityMapper } from './IdentityMapper';

export class PigeonIdentityRepository implements IdentityRepository {
  public constructor(
    private readonly gateway: PigeonIdentitiesGateway,
    private readonly contexts: IdentityAccessContexts,
    private readonly mapper: IdentityMapper,
    private readonly creationMaterials: IdentityCreationMaterials,
  ) {}

  public async create(
    identity: Identity,
    protection: IdentityMasterKeyProtection,
  ): Promise<Identity> {
    const primitives = identity.toPrimitives();
    const identityId = IdentityId.fromString(primitives.id);
    const material = this.creationMaterials.consume(identityId);
    const created = await this.gateway.createIdentityAggregate(
      identity,
      material,
      protection,
    );
    const session = {
      authorizationEpoch: created.authorizationEpoch,
      authorizationRevision: created.authorizationRevision,
      deviceCredentialKeyPair: created.deviceCredentialKeyPair,
      deviceId: created.deviceId,
      identity: created.identity,
      keychain: { conversations: {}, version: 0 },
      keyPair: created.keyPair,
      masterKey: created.masterKey,
      recoveryAuthorityKeyPair: created.recoveryAuthorityKeyPair,
    };

    this.contexts.register(session);

    return this.mapper.fromResource(created.identity);
  }

  public async find(identityId: IdentityId): Promise<Identity> {
    return this.mapper.fromResource(
      await this.gateway.getIdentity(identityId.toString()),
    );
  }

  public async refresh(identityId: IdentityId): Promise<Identity> {
    return this.mapper.fromResource(
      await this.gateway.refreshIdentity(identityId.toString()),
    );
  }

  public async update(
    identity: Identity,
    actorIdentityId: IdentityId,
  ): Promise<Identity> {
    const context = this.contexts.find(actorIdentityId);
    const resource = await this.gateway.updateIdentityProfile(
      context.session,
      this.mapper.toProfileUpdate(identity),
      context.newPassword,
      context.options,
    );

    return this.mapper.fromResource(resource);
  }
}
