import {
  KeyPair,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
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
  async function fixture(historyTransferSecret?: SymmetricKey) {
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
      historyTransferSecret,
      identityKeyPair,
      recoveryAuthorityKeyPair,
      request: draft.getRequest(),
      rootKey,
    });

    return { completion, draft, identityId, identityKeyPair, rootKey };
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

  it('carries the history transfer secret inside the encrypted material', async () => {
    const historyTransferSecret = SymmetricKey.generate();
    const source = await fixture(historyTransferSecret);
    const material = DevicePairingCompletion.fromCode(
      source.completion.toCode(),
    ).open(source.draft.getRequest(), source.draft.getTransportKeyPair());

    expect(material.getHistoryTransferSecret()?.valueOf()).toBe(
      historyTransferSecret.valueOf(),
    );
  });

  it('opens without a history transfer secret when none was published', async () => {
    const source = await fixture();
    const material = DevicePairingCompletion.fromCode(
      source.completion.toCode(),
    ).open(source.draft.getRequest(), source.draft.getTransportKeyPair());

    expect(material.getHistoryTransferSecret()).toBeUndefined();
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

  it('rejects a completion whose material was swapped in from another completion', async () => {
    const source = await fixture();
    const other = await fixture();
    const resource = source.completion.toCode().decode() as Record<
      string,
      unknown
    >;
    const foreign = other.completion.toCode().decode() as Record<
      string,
      unknown
    >;
    const completion = DevicePairingCompletion.fromCode(
      DevicePairingCode.encode({
        ...resource,
        encryptedMaterial: foreign.encryptedMaterial,
      }),
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

  it('rejects a completion signed by a device other than the invitation author', async () => {
    const source = await fixture();
    const forged = DevicePairingCompletion.create({
      author: await KeyPair.generate(),
      checkpoint: DeviceAuthorizationCheckpoint.fromResource(
        {
          epoch: 'genesis',
          identityId: source.identityId.valueOf(),
          revision: 4,
        },
        source.identityId,
      ),
      identityKeyPair: source.identityKeyPair,
      recoveryAuthorityKeyPair: await KeyPair.generate(),
      request: source.draft.getRequest(),
      rootKey: source.rootKey,
    });

    expect(
      thrownPairingFailure(() =>
        DevicePairingCompletion.fromCode(forged.toCode()).open(
          source.draft.getRequest(),
          source.draft.getTransportKeyPair(),
        ),
      ),
    ).toBe('invalid');
  });
});
