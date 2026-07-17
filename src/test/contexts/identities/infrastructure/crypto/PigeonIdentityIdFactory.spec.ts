import { IdentityCreationMaterials } from '../../../../../contexts/identities/infrastructure/crypto/IdentityCreationMaterials';
import { PigeonIdentityIdFactory } from '../../../../../contexts/identities/infrastructure/crypto/PigeonIdentityIdFactory';

describe(PigeonIdentityIdFactory.name, () => {
  it('creates an identity id and retains its key material for persistence', async () => {
    const materials = new IdentityCreationMaterials();
    const identityId = await new PigeonIdentityIdFactory(materials).create();
    const material = materials.consume(identityId);

    expect(material.keyPair.toPrimitives().publicKey).toContain(
      identityId.toString(),
    );
    expect(material.masterKey).toBeDefined();
  });
});
