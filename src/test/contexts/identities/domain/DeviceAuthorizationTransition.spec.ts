import {
  DeviceAuthorizationTransitionSignature,
  KeyPair,
  Signature,
} from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/device-authorization-transition.json';
import { Timestamp } from '@haskou/value-objects';

import type { DeviceAuthorizationCompromisedCredential } from '../../../../contexts/identities/domain/DeviceAuthorizationCompromisedCredential';
import type { DeviceAuthorizationUnsignedPayload } from '../../../../contexts/identities/domain/DeviceAuthorizationUnsignedPayload';

import { DeviceAuthorizationTransition } from '../../../../contexts/identities/domain/DeviceAuthorizationTransition';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../contexts/identities/domain/value-objects/DeviceCredential';
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
      'compromisedCredentials',
      'compromisedSince',
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
        DeviceAuthorizationTransitionSignature.proofOfPossessionContent(
          unsigned,
        ),
        new Signature(body.proofOfPossession ?? ''),
      ),
    ).toBe(true);
    expect(
      author.isValidSignature(
        DeviceAuthorizationTransitionSignature.signingContent(
          unsigned,
          new Signature(body.proofOfPossession ?? ''),
        ),
        new Signature(body.signature),
      ),
    ).toBe(true);
  });

  it('advances the epoch to the recovery operation id', async () => {
    const identity = await KeyPair.generate();
    const recoveryAuthority = await KeyPair.generate();
    const operationId = DeviceAuthorizationOperationId.generate();
    const transition = DeviceAuthorizationTransition.recovery({
      compromisedCredentials: [],
      epoch: DeviceAuthorizationEpoch.genesis(),
      identityId: IdentityId.fromString(identity.toPrimitives().publicKey),
      operationId,
      previousRevision: DeviceAuthorizationRevision.initial(),
      recoveryAuthority,
      target: await KeyPair.generate(),
    });

    expect(transition.getResultEpoch().valueOf()).toBe(operationId.valueOf());
  });

  it('covers the compromise revision with the author signature', async () => {
    const author = await KeyPair.generate();
    const identity = await KeyPair.generate();
    const target = await KeyPair.generate();
    const make = (compromisedSince?: number) =>
      DeviceAuthorizationTransition.revocation({
        author,
        compromisedSince:
          compromisedSince === undefined
            ? undefined
            : DeviceAuthorizationRevision.fromNumber(compromisedSince),
        epoch: DeviceAuthorizationEpoch.genesis(),
        identityId: IdentityId.fromString(identity.toPrimitives().publicKey),
        operationId: DeviceAuthorizationOperationId.generate(),
        previousRevision: DeviceAuthorizationRevision.fromNumber(4),
        targetCredential: DeviceCredential.fromString(
          target.toPrimitives().publicKey,
        ),
      });
    const transition = make(2);
    const body = transition.toPrimitives();

    expect(body.compromisedSince).toBe(2);
    expect(
      IdentityId.fromString(author.toPrimitives().publicKey)
        .getPublicKey()
        .isValidSignature(
          DeviceAuthorizationTransitionSignature.signingContent(
            transition.getUnsignedPayload(),
          ),
          new Signature(body.signature),
        ),
    ).toBe(true);
    expect(
      IdentityId.fromString(author.toPrimitives().publicKey)
        .getPublicKey()
        .isValidSignature(
          DeviceAuthorizationTransitionSignature.signingContent({
            ...transition.getUnsignedPayload(),
            compromisedSince: 1,
          }),
          new Signature(body.signature),
        ),
    ).toBe(false);
    expect(make().toPrimitives().compromisedSince).toBeUndefined();
  });

  describe('compromise caps', () => {
    let recoveryAuthority: KeyPair;
    let target: KeyPair;

    beforeAll(async () => {
      recoveryAuthority = await KeyPair.generate();
      target = await KeyPair.generate();
    });

    const cap = (compromisedSince: number, credential: DeviceCredential) => ({
      compromisedSince:
        DeviceAuthorizationRevision.fromNumber(compromisedSince),
      credential,
    });
    const credentialOf = async () =>
      DeviceCredential.fromString(
        (await KeyPair.generate()).toPrimitives().publicKey,
      );
    const recoveryWith = (
      compromisedCredentials: DeviceAuthorizationCompromisedCredential[],
      previousRevision = 4,
    ) =>
      DeviceAuthorizationTransition.recovery({
        compromisedCredentials,
        epoch: DeviceAuthorizationEpoch.genesis(),
        identityId: IdentityId.fromString(vectors.identityId),
        operationId: DeviceAuthorizationOperationId.generate(),
        previousRevision:
          DeviceAuthorizationRevision.fromNumber(previousRevision),
        recoveryAuthority,
        target,
      });

    it('refuses duplicate credentials', async () => {
      const credential = await credentialOf();

      expect(() =>
        recoveryWith([cap(1, credential), cap(2, credential)]),
      ).toThrow();
    });

    it('refuses more than 32 compromised credentials', async () => {
      const caps = await Promise.all(
        Array.from({ length: 33 }, async () => cap(1, await credentialOf())),
      );

      expect(() => recoveryWith(caps)).toThrow();
    });

    it('accepts exactly 32 compromised credentials at the previous revision', async () => {
      const caps = await Promise.all(
        Array.from({ length: 32 }, async () => cap(4, await credentialOf())),
      );

      expect(
        recoveryWith(caps).getUnsignedPayload().compromisedCredentials,
      ).toHaveLength(32);
    });

    it('refuses a compromise after the previous revision', async () => {
      const credential = await credentialOf();

      expect(() => recoveryWith([cap(5, credential)])).toThrow();
    });

    it('covers the compromised credentials with the recovery signature', async () => {
      const credential = await credentialOf();
      const transition = recoveryWith([cap(2, credential)]);
      const body = transition.toPrimitives();
      const signed = (unsigned: DeviceAuthorizationUnsignedPayload) =>
        DeviceAuthorizationTransitionSignature.signingContent(
          unsigned,
          body.proofOfPossession === undefined
            ? undefined
            : new Signature(body.proofOfPossession),
        );

      expect(
        recoveryAuthority.isValidSignature(
          signed(transition.getUnsignedPayload()),
          new Signature(body.signature),
        ),
      ).toBe(true);
      expect(
        recoveryAuthority.isValidSignature(
          signed({
            ...transition.getUnsignedPayload(),
            compromisedCredentials: [
              { compromisedSince: 3, credential: credential.valueOf() },
            ],
          }),
          new Signature(body.signature),
        ),
      ).toBe(false);
    });
  });
});
