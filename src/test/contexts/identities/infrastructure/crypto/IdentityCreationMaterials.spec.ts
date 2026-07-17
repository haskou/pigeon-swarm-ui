import { KeyPair, SymmetricKey } from '@haskou/value-objects';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityCreationMaterialNotFoundError } from '../../../../../contexts/identities/infrastructure/crypto/IdentityCreationMaterialNotFoundError';
import { IdentityCreationMaterials } from '../../../../../contexts/identities/infrastructure/crypto/IdentityCreationMaterials';

describe(IdentityCreationMaterials.name, () => {
  it('consumes generated material exactly once', async () => {
    const materials = new IdentityCreationMaterials();
    const keyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(keyPair.toPrimitives().publicKey);
    const material = { keyPair, masterKey: SymmetricKey.generate() };

    materials.register(identityId, material);

    expect(materials.consume(identityId)).toBe(material);
    expect(() => materials.consume(identityId)).toThrow(
      IdentityCreationMaterialNotFoundError,
    );
  });
});
