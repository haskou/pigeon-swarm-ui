import { StringValueObject } from '@haskou/value-objects';

import { RecoveryKey } from '../../../../../contexts/identities/domain/value-objects/RecoveryKey';
import { RecoveryAuthorityKeyPair } from '../../../../../contexts/identities/infrastructure/crypto/RecoveryAuthorityKeyPair';
import { RecoveryIdentityMaterial } from '../../../../../contexts/identities/infrastructure/crypto/RecoveryIdentityMaterial';

describe(RecoveryAuthorityKeyPair.name, () => {
  it('derives a stable authority from the high-entropy kit and identity', async () => {
    const recoveryKey = RecoveryKey.generate();
    const identityId = new StringValueObject('identity-a');

    const first = await RecoveryAuthorityKeyPair.derive(
      recoveryKey,
      identityId,
    );
    const second = await RecoveryAuthorityKeyPair.derive(
      recoveryKey,
      identityId,
    );
    const otherIdentity = await RecoveryAuthorityKeyPair.derive(
      recoveryKey,
      new StringValueObject('identity-b'),
    );

    expect(first.toPrimitives()).toEqual(second.toPrimitives());
    expect(first.toPrimitives()).not.toEqual(otherIdentity.toPrimitives());
  });
});

describe(RecoveryIdentityMaterial.name, () => {
  it('recovers the stable identity and root while separating their keys', async () => {
    const recoveryKey = RecoveryKey.generate();

    const first = await RecoveryIdentityMaterial.derive(recoveryKey);
    const second = await RecoveryIdentityMaterial.derive(recoveryKey);

    expect(first.identityKeyPair.toPrimitives()).toEqual(
      second.identityKeyPair.toPrimitives(),
    );
    expect(first.rootKey.isEqual(second.rootKey)).toBe(true);
    expect(first.recoveryAuthorityKeyPair.toPrimitives()).toEqual(
      second.recoveryAuthorityKeyPair.toPrimitives(),
    );
    expect(first.identityKeyPair.toPrimitives().privateKey).not.toContain(
      first.rootKey.valueOf(),
    );
  });
});
