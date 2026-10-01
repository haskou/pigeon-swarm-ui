import { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import { DeviceAuthorizationTransition } from '../../../../contexts/identities/domain/DeviceAuthorizationTransition';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { PairingId } from '../../../../contexts/identities/domain/value-objects/PairingId';

describe(DeviceAuthorizationTransition.name, () => {
  it('binds enrollment epoch and exact canonical payload to both devices', async () => {
    const identity = await KeyPair.generate();
    const author = await KeyPair.generate();
    const target = await KeyPair.generate();
    const transition = DeviceAuthorizationTransition.enrollment({
      author,
      authorizedAt: new Timestamp(100),
      epoch: DeviceAuthorizationEpoch.genesis(),
      identityId: IdentityId.fromString(identity.toPrimitives().publicKey),
      operationId: DeviceAuthorizationOperationId.generate(),
      pairingExpiration: new Timestamp(200),
      pairingId: PairingId.generate(),
      previousRevision: DeviceAuthorizationRevision.initial(),
      target,
    });
    const body = transition.toPrimitives();
    const unsigned = transition.getUnsignedPayload();

    expect(Object.keys(unsigned)).toEqual([
      'authorCredential',
      'authorizedAt',
      'epoch',
      'identityId',
      'operation',
      'operationId',
      'pairingExpiration',
      'pairingId',
      'previousRevision',
      'revision',
      'targetCredential',
      'targetCredentialCommitment',
    ]);
    expect(
      target.isValidSignature(
        JSON.stringify({
          domain: 'pigeon:device-authorization:proof-of-possession:v2',
          transition: unsigned,
        }),
        new Signature(body.proofOfPossession ?? ''),
      ),
    ).toBe(true);
    expect(
      author.isValidSignature(
        JSON.stringify({
          domain: 'pigeon:device-authorization:transition:v3',
          proofOfPossession: body.proofOfPossession,
          transition: unsigned,
        }),
        new Signature(body.signature),
      ),
    ).toBe(true);
  });

  it('advances the epoch to the recovery operation id', async () => {
    const identity = await KeyPair.generate();
    const recoveryAuthority = await KeyPair.generate();
    const operationId = DeviceAuthorizationOperationId.generate();
    const transition = DeviceAuthorizationTransition.recovery({
      epoch: DeviceAuthorizationEpoch.genesis(),
      identityId: IdentityId.fromString(identity.toPrimitives().publicKey),
      operationId,
      previousRevision: DeviceAuthorizationRevision.initial(),
      recoveryAuthority,
      target: await KeyPair.generate(),
    });

    expect(transition.getResultEpoch().valueOf()).toBe(operationId.valueOf());
  });
});
