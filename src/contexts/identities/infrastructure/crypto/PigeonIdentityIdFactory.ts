import { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type { IdentityIdFactory } from '../../domain/IdentityIdFactory';
import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { IdentityCreationMaterials } from './IdentityCreationMaterials';

import { IdentityId as DomainIdentityId } from '../../domain/value-objects/IdentityId';

export class PigeonIdentityIdFactory implements IdentityIdFactory {
  public constructor(private readonly materials: IdentityCreationMaterials) {}

  public async create(): Promise<IdentityId> {
    const keyPair = await KeyPair.generate();
    const identityId = DomainIdentityId.fromString(
      keyPair.toPrimitives().publicKey,
    );

    this.materials.register(identityId, {
      keyPair,
      masterKey: SymmetricKey.generate(),
    });

    return identityId;
  }
}
