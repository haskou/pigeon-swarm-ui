import {
  DeviceAuthorizationTransitionSignature,
  KeyPair,
  Signature,
} from '@haskou/pigeon-swarm-crypto';
import vectors from '@haskou/pigeon-swarm-crypto/vectors/device-authorization-transition.json';
import { Timestamp } from '@haskou/value-objects';

import { DeviceAuthorizationTransition } from '../../../../contexts/identities/domain/DeviceAuthorizationTransition';
import { DeviceAuthorizationEpoch } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { IdentityId } from '../../../../contexts/identities/domain/value-objects/IdentityId';
import { PairingId } from '../../../../contexts/identities/domain/value-objects/PairingId';

type Vector = {
  expected: {
    proofOfPossessionPayload: null | string;
    signingPayload: string;
    transition: Record<string, unknown>;
  };
  input: {
    authorizedAt?: number;
    compromisedCredentials?: { compromisedSince: number; credential: string }[];
    compromisedSince?: number;
    epoch: string;
    operation: 'enroll' | 'recover' | 'revoke';
    operationId: string;
    pairingExpiration?: number;
    pairingId?: string;
    previousRevision: number;
    targetCredential: string;
  };
  name: string;
};

const keyOf = (pair: { privateKeyPem: string; publicKeyPem: string }) =>
  KeyPair.fromPrimitives({
    privateKey: pair.privateKeyPem,
    publicKey: pair.publicKeyPem,
  } as never);
const author = keyOf(vectors.keys.author);
const recoveryAuthority = keyOf(vectors.keys.recoveryAuthority);
const target = keyOf(vectors.keys.target);
const cases = vectors.cases as Vector[];
const identityId = IdentityId.fromString(vectors.identityId);

const common = (input: Vector['input']) => ({
  epoch: DeviceAuthorizationEpoch.fromString(input.epoch),
  identityId,
  operationId: DeviceAuthorizationOperationId.fromString(input.operationId),
  previousRevision: DeviceAuthorizationRevision.fromNumber(
    input.previousRevision,
  ),
});
const pairing = (input: Vector['input']) => ({
  authorizedAt: new Timestamp(input.authorizedAt),
  pairingExpiration: new Timestamp(input.pairingExpiration),
  pairingId: PairingId.fromString(input.pairingId as string),
});

const build = ({ input }: Vector): DeviceAuthorizationTransition => {
  if (input.operation === 'enroll') {
    return DeviceAuthorizationTransition.enrollment({
      ...common(input),
      ...pairing(input),
      author,
      target,
    });
  }

  if (input.operation === 'recover') {
    return DeviceAuthorizationTransition.recovery({
      ...common(input),
      compromisedCredentials: (input.compromisedCredentials ?? []).map(
        (entry) => ({
          compromisedSince: DeviceAuthorizationRevision.fromNumber(
            entry.compromisedSince,
          ),
          credential: DeviceCredential.fromString(entry.credential),
        }),
      ),
      recoveryAuthority,
      target,
    });
  }

  return DeviceAuthorizationTransition.revocation({
    ...common(input),
    author,
    compromisedSince:
      input.compromisedSince === undefined
        ? undefined
        : DeviceAuthorizationRevision.fromNumber(input.compromisedSince),
    targetCredential: DeviceCredential.fromString(input.targetCredential),
  });
};

describe('device authorization transition vectors from @haskou/pigeon-swarm-crypto', () => {
  it.each(cases)('signs $name byte for byte', (vector) => {
    expect(JSON.parse(JSON.stringify(build(vector).toPrimitives()))).toEqual(
      vector.expected.transition,
    );
  });

  it.each(cases)('derives the payloads of $name', (vector) => {
    const transition = build(vector);
    const body = transition.toPrimitives();

    const proofOfPossession =
      body.proofOfPossession === undefined
        ? undefined
        : new Signature(body.proofOfPossession);

    expect(
      DeviceAuthorizationTransitionSignature.signingContent(
        transition.getUnsignedPayload(),
        proofOfPossession,
      ),
    ).toBe(vector.expected.signingPayload);
    expect(
      proofOfPossession === undefined
        ? null
        : DeviceAuthorizationTransitionSignature.proofOfPossessionContent(
            transition.getUnsignedPayload(),
          ),
    ).toBe(vector.expected.proofOfPossessionPayload);
  });

  it('builds the paired enrollment from the proof of the new device', () => {
    const vector = cases.find(({ input }) => input.operation === 'enroll');
    const input = (vector as Vector).input;
    const enrollment = {
      ...common(input),
      ...pairing(input),
      authorCredential: DeviceCredential.fromString(
        vectors.keys.author.publicKeyPem,
      ),
    };
    const proof = DeviceAuthorizationTransition.proveEnrollment({
      ...enrollment,
      target,
    });

    expect(proof.getSignature().valueOf()).toBe(
      (vector as Vector).expected.transition.proofOfPossession,
    );
    expect(
      DeviceAuthorizationTransition.isValidEnrollmentProof({
        ...enrollment,
        proof,
      }),
    ).toBe(true);
    expect(
      JSON.parse(
        JSON.stringify(
          DeviceAuthorizationTransition.enrollmentWithProof({
            ...common(input),
            ...pairing(input),
            author,
            proofOfPossession: proof.getSignature(),
            targetCredential: proof.getCredential(),
          }).toPrimitives(),
        ),
      ),
    ).toEqual((vector as Vector).expected.transition);
  });
});
