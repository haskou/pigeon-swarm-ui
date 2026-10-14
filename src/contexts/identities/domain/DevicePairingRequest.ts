import { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import type { DevicePairingRequestPayload } from './DevicePairingRequestPayload';

import { DeviceAuthorizationEnrollmentProof } from './DeviceAuthorizationEnrollmentProof';
import { DeviceAuthorizationTransition } from './DeviceAuthorizationTransition';
import { DevicePairingError } from './DevicePairingError';
import { DevicePairingInvitation } from './DevicePairingInvitation';
import { DevicePairingRequestDraft } from './DevicePairingRequestDraft';
import { DeviceAuthorizationOperationId } from './value-objects/DeviceAuthorizationOperationId';
import { DevicePairingCode } from './value-objects/DevicePairingCode';
import { PairingTransportPublicKey } from './value-objects/PairingTransportPublicKey';

const DOMAIN = 'pigeon:device-pairing:request:v1';
const KIND = 'pigeon-device-pairing-request';
const VERIFICATION_DOMAIN = 'pigeon:device-pairing:verification:v1';
const MAX_FUTURE_SKEW_MS = 30_000;

export class DevicePairingRequest {
  /** Restores a request read from a code; it must verify at `acceptedAt`. */
  public static restore(
    state: {
      authorizedAt: Timestamp;
      invitation: DevicePairingInvitation;
      operationId: DeviceAuthorizationOperationId;
      proof: DeviceAuthorizationEnrollmentProof;
      signature: Signature;
      transportPublicKey: PairingTransportPublicKey;
    },
    acceptedAt: Timestamp,
  ): DevicePairingRequest {
    const request = new DevicePairingRequest(
      state.authorizedAt,
      state.invitation,
      state.operationId,
      state.proof,
      state.transportPublicKey,
      state.signature,
    );

    request.assertValidAt(acceptedAt);

    return request;
  }

  public static async create(
    invitation: DevicePairingInvitation,
    authorizedAt: Timestamp,
  ): Promise<DevicePairingRequestDraft> {
    invitation.assertValidAt(authorizedAt);
    const target = await KeyPair.generate();
    const transport = await KeyPair.generate();
    const operationId = DeviceAuthorizationOperationId.generate();
    const proof = DeviceAuthorizationTransition.proveEnrollment({
      authorCredential: invitation.getAuthorCredential(),
      authorizedAt,
      epoch: invitation.getEpoch(),
      identityId: invitation.getIdentityId(),
      operationId,
      pairingExpiration: invitation.getExpiration(),
      pairingId: invitation.getPairingId(),
      previousRevision: invitation.getRevision(),
      target,
    });
    const request = new DevicePairingRequest(
      authorizedAt,
      invitation,
      operationId,
      proof,
      PairingTransportPublicKey.fromString(transport.toPrimitives().publicKey),
      undefined,
    );

    return new DevicePairingRequestDraft(
      request.withSignature(target.sign(request.signingPayload())),
      target,
      transport,
    );
  }

  private constructor(
    private readonly authorizedAt: Timestamp,
    private readonly invitation: DevicePairingInvitation,
    private readonly operationId: DeviceAuthorizationOperationId,
    private readonly proof: DeviceAuthorizationEnrollmentProof,
    private readonly transportPublicKey: PairingTransportPublicKey,
    private readonly signature: Signature | undefined,
  ) {}

  private payload(): DevicePairingRequestPayload {
    return {
      authorizedAt: this.authorizedAt.valueOf(),
      invitation: this.invitation.toCode().valueOf(),
      operationId: this.operationId.valueOf(),
      proofOfPossession: this.proof.getSignature().valueOf(),
      targetCredential: this.proof.getCredential().valueOf(),
      transportPublicKey: this.transportPublicKey.valueOf(),
      version: 1,
    };
  }

  private signingPayload(): string {
    return JSON.stringify({ domain: DOMAIN, request: this.payload() });
  }

  private withSignature(signature: Signature): DevicePairingRequest {
    return new DevicePairingRequest(
      this.authorizedAt,
      this.invitation,
      this.operationId,
      this.proof,
      this.transportPublicKey,
      signature,
    );
  }

  public assertValidAt(acceptedAt: Timestamp): void {
    this.invitation.assertValidAt(acceptedAt);
    assert(
      this.signature,
      new DevicePairingError('invalid', 'Invalid device pairing request.'),
    );
    assert(
      this.authorizedAt.isBeforeOrEqual(this.invitation.getExpiration()),
      new DevicePairingError('expired', 'Expired device pairing request.'),
    );
    assert(
      this.authorizedAt.isBeforeOrEqual(
        acceptedAt.addMilliseconds(MAX_FUTURE_SKEW_MS),
      ) &&
        DeviceAuthorizationTransition.isValidEnrollmentProof({
          authorCredential: this.invitation.getAuthorCredential(),
          authorizedAt: this.authorizedAt,
          epoch: this.invitation.getEpoch(),
          identityId: this.invitation.getIdentityId(),
          operationId: this.operationId,
          pairingExpiration: this.invitation.getExpiration(),
          pairingId: this.invitation.getPairingId(),
          previousRevision: this.invitation.getRevision(),
          proof: this.proof,
        }) &&
        this.proof
          .getCredential()
          .getPublicKey()
          .isValidSignature(this.signingPayload(), this.signature),
      new DevicePairingError(
        'invalid',
        'Invalid or expired device pairing request.',
      ),
    );
  }

  public async getVerificationCode(): Promise<string> {
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          JSON.stringify({
            domain: VERIFICATION_DOMAIN,
            operationId: this.operationId.valueOf(),
            pairingId: this.invitation.getPairingId().valueOf(),
            targetCredential: this.proof.getCredential().valueOf(),
            transportPublicKey: this.transportPublicKey.valueOf(),
          }),
        ),
      ),
    );
    const value = new DataView(digest.buffer).getBigUint64(0) % 10n ** 10n;
    const digits = value.toString().padStart(10, '0');

    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  public getInvitation(): DevicePairingInvitation {
    return this.invitation;
  }

  public getProof(): DeviceAuthorizationEnrollmentProof {
    return this.proof;
  }

  public getOperationId(): DeviceAuthorizationOperationId {
    return this.operationId;
  }

  public getAuthorizedAt(): Timestamp {
    return this.authorizedAt;
  }

  public getTransportPublicKey(): PairingTransportPublicKey {
    return this.transportPublicKey;
  }

  public toCode(): DevicePairingCode {
    assert(this.signature, new Error('Unsigned device pairing request.'));

    return DevicePairingCode.encode({
      kind: KIND,
      ...this.payload(),
      signature: this.signature.valueOf(),
    });
  }
}
