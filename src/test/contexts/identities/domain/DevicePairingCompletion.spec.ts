import { KeyPair, UserRootKey } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import { DeviceAuthorizationCheckpoint } from '../../../../contexts/identities/domain/DeviceAuthorizationCheckpoint';
import { DevicePairingCompletion } from '../../../../contexts/identities/domain/DevicePairingCompletion';
import { DevicePairingInvitation } from '../../../../contexts/identities/domain/DevicePairingInvitation';
import { DevicePairingRequest } from '../../../../contexts/identities/domain/DevicePairingRequest';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DevicePairingCode } from '../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { PairingId } from '../../../../contexts/identities/domain/value-objects/PairingId';
import { thrownPairingFailure } from './thrownPairingFailure';

describe(DevicePairingCompletion.name, () => {
  async function fixture() {
    const author = await KeyPair.generate();
    const identityKeyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(
      identityKeyPair.toPrimitives().publicKey,
    );
    const invitation = DevicePairingInvitation.create({
      author,
      epoch: DeviceAuthorizationEpoch.genesis(),
      expiresAt: new Timestamp(2_000),
      identityId,
      pairingId: PairingId.generate(),
      revision: DeviceAuthorizationRevision.fromNumber(3),
    });
    const draft = await DevicePairingRequest.create(
      invitation,
      new Timestamp(1_000),
    );
    const rootKey = UserRootKey.generate();
    const recoveryAuthorityKeyPair = await KeyPair.generate();
    const completion = DevicePairingCompletion.create({
      author,
      checkpoint: DeviceAuthorizationCheckpoint.fromResource(
        { epoch: 'genesis', identityId: identityId.valueOf(), revision: 4 },
        identityId,
      ),
      identityKeyPair,
      recoveryAuthorityKeyPair,
      request: draft.getRequest(),
      rootKey,
    });

    return { completion, draft, identityKeyPair, rootKey };
  }

  it('transfers identity material only to the ephemeral target transport key', async () => {
    const source = await fixture();
    const completion = DevicePairingCompletion.fromCode(
      source.completion.toCode(),
    );
    const material = completion.open(
      source.draft.getRequest(),
      source.draft.getTransportKeyPair(),
    );

    expect(material.getIdentityKeyPair().toPrimitives()).toEqual(
      source.identityKeyPair.toPrimitives(),
    );
    expect(material.getRootKey().isEqual(source.rootKey)).toBe(true);
  });

  it('rejects tampered completion checkpoints before decryption', async () => {
    const source = await fixture();
    const resource = source.completion.toCode().decode() as Record<
      string,
      unknown
    >;
    const completion = DevicePairingCompletion.fromCode(
      DevicePairingCode.encode({ ...resource, revision: 5 }),
    );

    expect(
      thrownPairingFailure(() =>
        completion.open(
          source.draft.getRequest(),
          source.draft.getTransportKeyPair(),
        ),
      ),
    ).toBe('invalid');
  });
});
