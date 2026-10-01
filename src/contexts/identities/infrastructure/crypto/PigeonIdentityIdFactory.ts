import { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';

import type { IdentityIdFactory } from '../../domain/IdentityIdFactory';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import type { IdentityCreationMaterials } from './IdentityCreationMaterials';

import { IdentityId as DomainIdentityId } from '../../domain/value-objects/IdentityId';
import { RecoveryIdentityMaterial } from './RecoveryIdentityMaterial';

export class PigeonIdentityIdFactory implements IdentityIdFactory {
  public constructor(private readonly materials: IdentityCreationMaterials) {}

  public async create(recoveryKey: RecoveryKey): Promise<IdentityId> {
    const recovered = await RecoveryIdentityMaterial.derive(recoveryKey);
    const keyPair = recovered.identityKeyPair;
    const identityId = DomainIdentityId.fromString(
      keyPair.toPrimitives().publicKey,
    );

    this.materials.register(identityId, {
      deviceCredentialKeyPair: await KeyPair.generate(),
      keyPair,
      masterKey: SymmetricKey.fromBuffer(recovered.rootKey.getBuffer()),
      recoveryAuthorityKeyPair: recovered.recoveryAuthorityKeyPair,
    });

    return identityId;
  }
}
