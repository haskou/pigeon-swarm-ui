import {
  DeviceAuthorizationTransitionSignature,
  DeviceCredentialCommitment,
  KeyPair,
  PrivateKey,
  PublicKey,
  Signature,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import type { DeviceAuthorizationCompromisedCredential as CompromisedCredential } from './DeviceAuthorizationCompromisedCredential';
import type { DeviceAuthorizationCompromisedCredentialPayload } from './DeviceAuthorizationCompromisedCredentialPayload';
import type { DeviceAuthorizationOperation } from './DeviceAuthorizationOperation';
import type { DeviceAuthorizationTransitionPrimitives } from './DeviceAuthorizationTransitionPrimitives';
import type { DeviceAuthorizationUnsignedPayload } from './DeviceAuthorizationUnsignedPayload';

import { DeviceAuthorizationEnrollmentProof } from './DeviceAuthorizationEnrollmentProof';
import { InvalidDeviceAuthorizationTransitionError } from './errors/InvalidDeviceAuthorizationTransitionError';
import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from './value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { IdentityId } from './value-objects/IdentityId';
import { PairingId } from './value-objects/PairingId';

const MAX_COMPROMISED_CREDENTIALS = 32;
const OPERATIONS: readonly DeviceAuthorizationOperation[] = [
  'enroll',
  'recover',
  'revoke',
];

export class DeviceAuthorizationTransition {
  private static sign(input: {
    author: KeyPair;
    authorCredential?: string;
    authorizedAt?: Timestamp;
    compromisedCredentials?: CompromisedCredential[];
    compromisedSince?: DeviceAuthorizationRevision;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operation: DeviceAuthorizationOperation;
    operationId: DeviceAuthorizationOperationId;
    pairingExpiration?: Timestamp;
    pairingId?: PairingId;
    previousRevision: DeviceAuthorizationRevision;
    proofOfPossession?: Signature;
    target?: KeyPair;
    targetCredential?: DeviceCredential;
    targetProofRequired: boolean;
  }): DeviceAuthorizationTransition {
    const targetCredential =
      input.targetCredential?.valueOf() ??
      input.target?.toPrimitives().publicKey;
    assert(targetCredential, new Error('A target credential is required.'));
    const unsigned = this.unsigned({
      authorCredential:
        input.operation === 'recover'
          ? undefined
          : (input.authorCredential ?? input.author.toPrimitives().publicKey),
      authorizedAt: input.authorizedAt?.valueOf(),
      compromisedCredentials: this.compromisedCredentialsOf(
        input.compromisedCredentials,
        input.previousRevision,
      ),
      compromisedSince: input.compromisedSince?.valueOf(),
      epoch: input.epoch.valueOf(),
      identityId: input.identityId.valueOf(),
      operation: input.operation,
      operationId: input.operationId.valueOf(),
      pairingExpiration: input.pairingExpiration?.valueOf(),
      pairingId: input.pairingId?.valueOf(),
      previousRevision: input.previousRevision.valueOf(),
      targetCredential,
    });
    const target = input.target;

    let proofOfPossession = input.proofOfPossession;

    if (input.targetProofRequired && !proofOfPossession) {
      assert(target, new Error('A target key pair is required.'));
      proofOfPossession =
        DeviceAuthorizationTransitionSignature.provePossession(
          unsigned,
          new PrivateKey(target.toPrimitives().privateKey),
        );
    }
    const signature = DeviceAuthorizationTransitionSignature.sign(
      unsigned,
      proofOfPossession,
      new PrivateKey(input.author.toPrimitives().privateKey),
    ).valueOf();

    return new DeviceAuthorizationTransition(
      input.epoch,
      input.operationId,
      unsigned,
      proofOfPossession?.valueOf(),
      signature,
    );
  }

  private static compromisedCredentialsOf(
    credentials: CompromisedCredential[] | undefined,
    previousRevision: DeviceAuthorizationRevision,
  ): DeviceAuthorizationCompromisedCredentialPayload[] | undefined {
    const sorted = [...(credentials ?? [])].sort((left, right) =>
      left.credential.isLessThan(right.credential) ? -1 : 1,
    );

    if (sorted.length === 0) return undefined;

    assert(
      sorted.length <= MAX_COMPROMISED_CREDENTIALS,
      new Error('Too many compromised credentials.'),
    );
    assert(
      sorted.every(
        (entry, index) =>
          index === 0 ||
          sorted[index - 1].credential.isLessThan(entry.credential),
      ),
      new Error('Duplicate compromised credential.'),
    );

    return sorted.map((entry) => {
      assert(
        entry.compromisedSince.isLessOrEqualThan(previousRevision),
        new Error('Compromise follows the previous revision.'),
      );

      return {
        compromisedSince: entry.compromisedSince.valueOf(),
        credential: entry.credential.valueOf(),
      };
    });
  }

  private static unsigned(input: {
    authorCredential?: string;
    authorizedAt?: number;
    compromisedCredentials?: DeviceAuthorizationCompromisedCredentialPayload[];
    compromisedSince?: number;
    epoch: string;
    identityId: string;
    operation: DeviceAuthorizationOperation;
    operationId: string;
    pairingExpiration?: number;
    pairingId?: string;
    previousRevision: number;
    targetCredential: string;
  }): DeviceAuthorizationUnsignedPayload {
    return {
      authorCredential: input.authorCredential,
      authorizedAt: input.authorizedAt,
      compromisedCredentials: input.compromisedCredentials,
      compromisedSince: input.compromisedSince,
      epoch: input.epoch,
      identityId: input.identityId,
      operation: input.operation,
      operationId: input.operationId,
      pairingExpiration: input.pairingExpiration,
      pairingId: input.pairingId,
      previousRevision: input.previousRevision,
      revision: input.previousRevision + 1,
      targetCredential: input.targetCredential,
      targetCredentialCommitment: DeviceCredentialCommitment.of(
        new PublicKey(input.targetCredential),
      ),
    };
  }

  /**
   * Parses a transition a node served. It is rebuilt from canonical values
   * and rejected unless it encodes back to the exact fields served, so the
   * signature checks cover exactly what the replay reads.
   */
  public static fromPrimitives(
    primitives: DeviceAuthorizationTransitionPrimitives,
  ): DeviceAuthorizationTransition {
    assert(
      OPERATIONS.includes(primitives.operation),
      new InvalidDeviceAuthorizationTransitionError(),
    );
    const epoch = DeviceAuthorizationEpoch.fromString(primitives.epoch);
    const operationId = DeviceAuthorizationOperationId.fromString(
      primitives.operationId,
    );
    const unsigned = this.unsigned({
      authorCredential:
        primitives.authorCredential === undefined
          ? undefined
          : DeviceCredential.fromString(primitives.authorCredential).valueOf(),
      authorizedAt:
        primitives.authorizedAt === undefined
          ? undefined
          : new Timestamp(primitives.authorizedAt).valueOf(),
      compromisedCredentials: primitives.compromisedCredentials?.map(
        (entry) => ({
          compromisedSince: DeviceAuthorizationRevision.fromNumber(
            entry.compromisedSince,
          ).valueOf(),
          credential: DeviceCredential.fromString(entry.credential).valueOf(),
        }),
      ),
      compromisedSince:
        primitives.compromisedSince === undefined
          ? undefined
          : DeviceAuthorizationRevision.fromNumber(
              primitives.compromisedSince,
            ).valueOf(),
      epoch: epoch.valueOf(),
      identityId: IdentityId.fromString(primitives.identityId).valueOf(),
      operation: primitives.operation,
      operationId: operationId.valueOf(),
      pairingExpiration:
        primitives.pairingExpiration === undefined
          ? undefined
          : new Timestamp(primitives.pairingExpiration).valueOf(),
      pairingId:
        primitives.pairingId === undefined
          ? undefined
          : PairingId.fromString(primitives.pairingId).valueOf(),
      previousRevision: DeviceAuthorizationRevision.fromNumber(
        primitives.previousRevision,
      ).valueOf(),
      targetCredential: DeviceCredential.fromString(
        primitives.targetCredential,
      ).valueOf(),
    });
    const served: DeviceAuthorizationUnsignedPayload = {
      authorCredential: primitives.authorCredential,
      authorizedAt: primitives.authorizedAt,
      compromisedCredentials: primitives.compromisedCredentials?.map(
        (entry) => ({
          compromisedSince: entry.compromisedSince,
          credential: entry.credential,
        }),
      ),
      compromisedSince: primitives.compromisedSince,
      epoch: primitives.epoch,
      identityId: primitives.identityId,
      operation: primitives.operation,
      operationId: primitives.operationId,
      pairingExpiration: primitives.pairingExpiration,
      pairingId: primitives.pairingId,
      previousRevision: primitives.previousRevision,
      revision: primitives.revision,
      targetCredential: primitives.targetCredential,
      targetCredentialCommitment: primitives.targetCredentialCommitment,
    };
    const transition = new DeviceAuthorizationTransition(
      epoch,
      operationId,
      unsigned,
      primitives.proofOfPossession,
      primitives.signature,
    );

    assert(
      JSON.stringify(served) === JSON.stringify(unsigned) &&
        transition.hasValidShape(),
      new InvalidDeviceAuthorizationTransitionError(),
    );

    return transition;
  }

  public static isValidEnrollmentProof(input: {
    authorCredential: DeviceCredential;
    authorizedAt: Timestamp;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    pairingExpiration: Timestamp;
    pairingId: PairingId;
    previousRevision: DeviceAuthorizationRevision;
    proof: DeviceAuthorizationEnrollmentProof;
  }): boolean {
    const unsigned = this.unsigned({
      authorCredential: input.authorCredential.valueOf(),
      authorizedAt: input.authorizedAt.valueOf(),
      epoch: input.epoch.valueOf(),
      identityId: input.identityId.valueOf(),
      operation: 'enroll',
      operationId: input.operationId.valueOf(),
      pairingExpiration: input.pairingExpiration.valueOf(),
      pairingId: input.pairingId.valueOf(),
      previousRevision: input.previousRevision.valueOf(),
      targetCredential: input.proof.getCredential().valueOf(),
    });

    return DeviceAuthorizationTransition.verifies(() =>
      input.proof
        .getCredential()
        .getPublicKey()
        .isValidSignature(
          DeviceAuthorizationTransitionSignature.proofOfPossessionContent(
            unsigned,
          ),
          input.proof.getSignature(),
        ),
    );
  }

  public static proveEnrollment(input: {
    authorCredential: DeviceCredential;
    authorizedAt: Timestamp;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    pairingExpiration: Timestamp;
    pairingId: PairingId;
    previousRevision: DeviceAuthorizationRevision;
    target: KeyPair;
  }): DeviceAuthorizationEnrollmentProof {
    const credential = DeviceCredential.fromString(
      input.target.toPrimitives().publicKey,
    );
    const unsigned = this.unsigned({
      authorCredential: input.authorCredential.valueOf(),
      authorizedAt: input.authorizedAt.valueOf(),
      epoch: input.epoch.valueOf(),
      identityId: input.identityId.valueOf(),
      operation: 'enroll',
      operationId: input.operationId.valueOf(),
      pairingExpiration: input.pairingExpiration.valueOf(),
      pairingId: input.pairingId.valueOf(),
      previousRevision: input.previousRevision.valueOf(),
      targetCredential: credential.valueOf(),
    });

    return new DeviceAuthorizationEnrollmentProof(
      credential,
      DeviceAuthorizationTransitionSignature.provePossession(
        unsigned,
        new PrivateKey(input.target.toPrimitives().privateKey),
      ),
    );
  }

  public static enrollment(input: {
    author: KeyPair;
    authorizedAt: Timestamp;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    pairingExpiration: Timestamp;
    pairingId: PairingId;
    previousRevision: DeviceAuthorizationRevision;
    target: KeyPair;
  }): DeviceAuthorizationTransition {
    return this.sign({
      author: input.author,
      authorizedAt: input.authorizedAt,
      epoch: input.epoch,
      identityId: input.identityId,
      operation: 'enroll',
      operationId: input.operationId,
      pairingExpiration: input.pairingExpiration,
      pairingId: input.pairingId,
      previousRevision: input.previousRevision,
      target: input.target,
      targetProofRequired: true,
    });
  }

  public static recovery(input: {
    compromisedCredentials: CompromisedCredential[];
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    previousRevision: DeviceAuthorizationRevision;
    recoveryAuthority: KeyPair;
    target: KeyPair;
  }): DeviceAuthorizationTransition {
    return this.sign({
      author: input.recoveryAuthority,
      compromisedCredentials: input.compromisedCredentials,
      epoch: input.epoch,
      identityId: input.identityId,
      operation: 'recover',
      operationId: input.operationId,
      previousRevision: input.previousRevision,
      target: input.target,
      targetProofRequired: true,
    });
  }

  public static enrollmentWithProof(input: {
    author: KeyPair;
    authorizedAt: Timestamp;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    pairingExpiration: Timestamp;
    pairingId: PairingId;
    previousRevision: DeviceAuthorizationRevision;
    proofOfPossession: Signature;
    targetCredential: DeviceCredential;
  }): DeviceAuthorizationTransition {
    return this.sign({
      author: input.author,
      authorizedAt: input.authorizedAt,
      epoch: input.epoch,
      identityId: input.identityId,
      operation: 'enroll',
      operationId: input.operationId,
      pairingExpiration: input.pairingExpiration,
      pairingId: input.pairingId,
      previousRevision: input.previousRevision,
      proofOfPossession: input.proofOfPossession,
      targetCredential: input.targetCredential,
      targetProofRequired: true,
    });
  }

  public static revocation(input: {
    author: KeyPair;
    compromisedSince?: DeviceAuthorizationRevision;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    previousRevision: DeviceAuthorizationRevision;
    targetCredential: DeviceCredential;
  }): DeviceAuthorizationTransition {
    return this.sign({
      author: input.author,
      authorCredential: input.author.toPrimitives().publicKey,
      compromisedSince: input.compromisedSince,
      epoch: input.epoch,
      identityId: input.identityId,
      operation: 'revoke',
      operationId: input.operationId,
      previousRevision: input.previousRevision,
      targetCredential: input.targetCredential,
      targetProofRequired: false,
    });
  }

  private constructor(
    private readonly epoch: DeviceAuthorizationEpoch,
    private readonly operationId: DeviceAuthorizationOperationId,
    private readonly unsigned: DeviceAuthorizationUnsignedPayload,
    private readonly proofOfPossession: string | undefined,
    private readonly signature: string,
  ) {}

  private hasSignatureShape(): boolean {
    const proofOfPossession: unknown = this.proofOfPossession;
    const signature: unknown = this.signature;
    const proofShape = this.isRevocation()
      ? proofOfPossession === undefined
      : typeof proofOfPossession === 'string' && proofOfPossession.length > 0;

    return proofShape && typeof signature === 'string' && signature.length > 0;
  }

  private getCompromisedSince(): DeviceAuthorizationRevision | undefined {
    return this.unsigned.compromisedSince === undefined
      ? undefined
      : DeviceAuthorizationRevision.fromNumber(this.unsigned.compromisedSince);
  }

  /** Recoveries carry 1 to 32 caps in strict code-unit order. */
  private hasValidCompromisedCredentials(): boolean {
    if (this.unsigned.compromisedCredentials === undefined) return true;

    const compromised = this.getCompromisedCredentials();
    const previousRevision = this.getPreviousRevision();

    return (
      compromised.length > 0 &&
      compromised.length <= MAX_COMPROMISED_CREDENTIALS &&
      compromised.every(
        (entry, index) =>
          entry.compromisedSince.isLessOrEqualThan(previousRevision) &&
          (index === 0 ||
            compromised[index - 1].credential.isLessThan(entry.credential)),
      )
    );
  }

  private hasNoPairing(): boolean {
    return [
      this.unsigned.pairingId,
      this.unsigned.pairingExpiration,
      this.unsigned.authorizedAt,
    ].every((field) => field === undefined);
  }

  private hasEnrollmentShape(): boolean {
    return (
      this.unsigned.authorCredential !== undefined &&
      this.unsigned.pairingId !== undefined &&
      this.unsigned.pairingExpiration !== undefined &&
      this.unsigned.authorizedAt !== undefined &&
      this.getCompromisedSince() === undefined &&
      this.unsigned.compromisedCredentials === undefined
    );
  }

  private hasRevocationShape(): boolean {
    const compromisedSince = this.getCompromisedSince();

    return (
      this.unsigned.authorCredential !== undefined &&
      this.hasNoPairing() &&
      this.unsigned.compromisedCredentials === undefined &&
      (compromisedSince === undefined ||
        compromisedSince.isLessOrEqualThan(this.getPreviousRevision()))
    );
  }

  private hasRecoveryShape(): boolean {
    return (
      this.unsigned.authorCredential === undefined &&
      this.hasNoPairing() &&
      this.getCompromisedSince() === undefined &&
      this.hasValidCompromisedCredentials()
    );
  }

  /** Each operation carries exactly the fields its policy reads. */
  private hasValidShape(): boolean {
    if (!this.hasSignatureShape()) return false;

    if (this.isEnrollment()) return this.hasEnrollmentShape();

    return this.isRevocation()
      ? this.hasRevocationShape()
      : this.hasRecoveryShape();
  }

  public getEpoch(): DeviceAuthorizationEpoch {
    return this.epoch;
  }

  public getOperationId(): DeviceAuthorizationOperationId {
    return this.operationId;
  }

  public getTargetCredential(): DeviceCredential {
    return DeviceCredential.fromString(this.unsigned.targetCredential);
  }

  public getAuthorCredential(): DeviceCredential {
    assert(
      this.unsigned.authorCredential !== undefined,
      new InvalidDeviceAuthorizationTransitionError(),
    );

    return DeviceCredential.fromString(this.unsigned.authorCredential);
  }

  public getCompromisedCredentials(): CompromisedCredential[] {
    return (this.unsigned.compromisedCredentials ?? []).map((entry) => ({
      compromisedSince: DeviceAuthorizationRevision.fromNumber(
        entry.compromisedSince,
      ),
      credential: DeviceCredential.fromString(entry.credential),
    }));
  }

  public isEnrollment(): boolean {
    return this.unsigned.operation === 'enroll';
  }

  public isRevocation(): boolean {
    return this.unsigned.operation === 'revoke';
  }

  public isRecovery(): boolean {
    return this.unsigned.operation === 'recover';
  }

  /** A signature check that fails closed on malformed input. */
  private static verifies(check: () => boolean): boolean {
    try {
      return check();
    } catch {
      return false;
    }
  }

  /** Whether the key signed this transition together with its target proof. */
  public isSignedBy(publicKey: PublicKey): boolean {
    return DeviceAuthorizationTransition.verifies(() => {
      DeviceAuthorizationTransitionSignature.verify(
        this.unsigned,
        this.proofOfPossession === undefined
          ? undefined
          : new Signature(this.proofOfPossession),
        new Signature(this.signature),
        publicKey,
      );

      return true;
    });
  }

  /** Whether the target credential proved it holds its private key. */
  public hasTargetProof(): boolean {
    const proof = this.proofOfPossession;

    return (
      proof !== undefined &&
      DeviceAuthorizationTransition.verifies(() =>
        this.getTargetCredential()
          .getPublicKey()
          .isValidSignature(
            DeviceAuthorizationTransitionSignature.proofOfPossessionContent(
              this.unsigned,
            ),
            new Signature(proof),
          ),
      )
    );
  }

  /** Concurrent transitions with one effect replay as one. */
  public hasSameEffectAs(other: DeviceAuthorizationTransition): boolean {
    const compromisedSince = this.getCompromisedSince();
    const otherCompromisedSince = other.getCompromisedSince();
    const hasSameCompromisedSince =
      compromisedSince === undefined || otherCompromisedSince === undefined
        ? compromisedSince === otherCompromisedSince
        : compromisedSince.isEqual(otherCompromisedSince);

    return (
      this.unsigned.operation === other.unsigned.operation &&
      this.getPreviousRevision().isEqual(other.getPreviousRevision()) &&
      this.getTargetCredential().isEqual(other.getTargetCredential()) &&
      hasSameCompromisedSince
    );
  }

  public getResultEpoch(): DeviceAuthorizationEpoch {
    return this.unsigned.operation === 'recover'
      ? DeviceAuthorizationEpoch.fromString(this.operationId.valueOf())
      : this.epoch;
  }

  public getIdentityId(): IdentityId {
    return IdentityId.fromString(this.unsigned.identityId);
  }

  public getPreviousRevision(): DeviceAuthorizationRevision {
    return DeviceAuthorizationRevision.fromNumber(
      this.unsigned.previousRevision,
    );
  }

  public getResultRevision(): DeviceAuthorizationRevision {
    return DeviceAuthorizationRevision.fromNumber(this.unsigned.revision);
  }

  public getUnsignedPayload(): DeviceAuthorizationUnsignedPayload {
    return { ...this.unsigned };
  }

  public toPrimitives(): DeviceAuthorizationTransitionPrimitives {
    return {
      ...this.unsigned,
      proofOfPossession: this.proofOfPossession,
      signature: this.signature,
    };
  }
}
