import { KeyPair, SHA256Hash, Signature } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject, Timestamp, assert } from '@haskou/value-objects';

import type {
  DeviceAuthorizationCompromisedCredential,
  DeviceAuthorizationCompromisedCredentialResource,
} from './DeviceAuthorizationCompromisedCredential';
import type { DeviceAuthorizationOperation } from './DeviceAuthorizationOperation';
import type { DeviceAuthorizationTransitionResource } from './DeviceAuthorizationTransitionResource';
import type { DeviceAuthorizationUnsignedPayload } from './DeviceAuthorizationUnsignedPayload';
import type { DeviceAuthorizationOperationId } from './value-objects/DeviceAuthorizationOperationId';
import type { PairingId } from './value-objects/PairingId';

import { DeviceAuthorizationEnrollmentProof } from './DeviceAuthorizationEnrollmentProof';
import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { IdentityId } from './value-objects/IdentityId';

const PROOF_DOMAIN = 'pigeon:device-authorization:proof-of-possession:v2';
const SIGNATURE_DOMAIN = 'pigeon:device-authorization:transition:v3';
const MAX_COMPROMISED_CREDENTIALS = 32;

export class DeviceAuthorizationTransition {
  private static sign(input: {
    author: KeyPair;
    authorCredential?: string;
    authorizedAt?: Timestamp;
    compromisedCredentials?: DeviceAuthorizationCompromisedCredential[];
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

    let proofOfPossession = input.proofOfPossession?.valueOf();

    if (input.targetProofRequired && !proofOfPossession) {
      assert(target, new Error('A target key pair is required.'));
      proofOfPossession = target
        .sign(JSON.stringify({ domain: PROOF_DOMAIN, transition: unsigned }))
        .valueOf();
    }
    const signature = input.author
      .sign(
        JSON.stringify({
          domain: SIGNATURE_DOMAIN,
          proofOfPossession,
          transition: unsigned,
        }),
      )
      .valueOf();

    return new DeviceAuthorizationTransition(
      input.epoch,
      input.operationId,
      unsigned,
      proofOfPossession,
      signature,
    );
  }

  private static compromisedCredentialsOf(
    credentials: DeviceAuthorizationCompromisedCredential[] | undefined,
    previousRevision: DeviceAuthorizationRevision,
  ): DeviceAuthorizationCompromisedCredentialResource[] | undefined {
    const sorted = [...(credentials ?? [])].sort((left, right) =>
      left.credential.valueOf() < right.credential.valueOf() ? -1 : 1,
    );

    if (sorted.length === 0) return undefined;

    assert(
      sorted.length <= MAX_COMPROMISED_CREDENTIALS,
      new Error('Too many compromised credentials.'),
    );
    assert(
      new Set(sorted.map((entry) => entry.credential.valueOf())).size ===
        sorted.length,
      new Error('Duplicate compromised credential.'),
    );

    return sorted.map((entry) => {
      assert(
        entry.compromisedSince.valueOf() <= previousRevision.valueOf(),
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
    compromisedCredentials?: DeviceAuthorizationCompromisedCredentialResource[];
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
      targetCredentialCommitment: SHA256Hash.from(
        new StringValueObject(input.targetCredential),
      ).valueOf(),
    };
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

    return input.proof
      .getCredential()
      .getPublicKey()
      .isValidSignature(
        JSON.stringify({ domain: PROOF_DOMAIN, transition: unsigned }),
        input.proof.getSignature(),
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
      input.target.sign(
        JSON.stringify({ domain: PROOF_DOMAIN, transition: unsigned }),
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
    compromisedCredentials: DeviceAuthorizationCompromisedCredential[];
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

  public toPrimitives(): DeviceAuthorizationTransitionResource {
    return {
      ...this.unsigned,
      proofOfPossession: this.proofOfPossession,
      signature: this.signature,
    };
  }
}
