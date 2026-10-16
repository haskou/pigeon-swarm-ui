import type { RecoveryKey } from '@haskou/pigeon-swarm-crypto';

import {
  KeyPair,
  RecoveryKit,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';

import type { IdentityIdFactory } from '../../domain/IdentityIdFactory';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityCreationMaterials } from './IdentityCreationMaterials';

import { IdentityId as DomainIdentityId } from '../../domain/value-objects/IdentityId';

export class PigeonIdentityIdFactory implements IdentityIdFactory {
  public constructor(private readonly materials: IdentityCreationMaterials) {}

  public async create(recoveryKey: RecoveryKey): Promise<IdentityId> {
    const recovered = RecoveryKit.derive(recoveryKey);
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
