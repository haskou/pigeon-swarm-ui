import { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import type { DevicePairingRequestPayload } from './DevicePairingRequestPayload';
import type { DevicePairingRequestResource } from './DevicePairingRequestResource';

import { DeviceAuthorizationEnrollmentProof } from './DeviceAuthorizationEnrollmentProof';
import { DeviceAuthorizationTransition } from './DeviceAuthorizationTransition';
import { DevicePairingError } from './DevicePairingError';
import { DevicePairingInvitation } from './DevicePairingInvitation';
import { DevicePairingRequestDraft } from './DevicePairingRequestDraft';
import { DevicePairingResource } from './DevicePairingResource';
import { DeviceAuthorizationOperationId } from './value-objects/DeviceAuthorizationOperationId';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { DevicePairingCode } from './value-objects/DevicePairingCode';
import { PairingTransportPublicKey } from './value-objects/PairingTransportPublicKey';

const DOMAIN = 'pigeon:device-pairing:request:v1';
const KIND = 'pigeon-device-pairing-request';
const VERIFICATION_DOMAIN = 'pigeon:device-pairing:verification:v1';
const MAX_FUTURE_SKEW_MS = 30_000;

export class DevicePairingRequest {
  private static resource(value: unknown): DevicePairingRequestResource {
    const resource = DevicePairingResource.fromUnknown(
      value,
      'Invalid device pairing request.',
    );
    resource.assertProtocol(KIND, 1);

    return {
      authorizedAt: resource.getNumber('authorizedAt'),
      invitation: resource.getString('invitation'),
      kind: KIND,
      operationId: resource.getString('operationId'),
      proofOfPossession: resource.getString('proofOfPossession'),
      signature: resource.getString('signature'),
      targetCredential: resource.getString('targetCredential'),
      transportPublicKey: resource.getString('transportPublicKey'),
      version: 1,
    };
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

  public static fromCode(
    code: DevicePairingCode,
    acceptedAt: Timestamp,
  ): DevicePairingRequest {
    const resource = this.resource(code.decode());
    const invitation = DevicePairingInvitation.fromCode(
      DevicePairingCode.fromString(resource.invitation),
      acceptedAt,
    );
    const request = new DevicePairingRequest(
      new Timestamp(resource.authorizedAt),
      invitation,
      DeviceAuthorizationOperationId.fromString(resource.operationId),
      new DeviceAuthorizationEnrollmentProof(
        DeviceCredential.fromString(resource.targetCredential),
        new Signature(resource.proofOfPossession),
      ),
      PairingTransportPublicKey.fromString(resource.transportPublicKey),
      new Signature(resource.signature),
    );

    request.assertValidAt(acceptedAt);

    return request;
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
      this.authorizedAt.valueOf() <= this.invitation.getExpiration().valueOf(),
      new DevicePairingError('expired', 'Expired device pairing request.'),
    );
    assert(
      this.authorizedAt.valueOf() <=
        acceptedAt.valueOf() + MAX_FUTURE_SKEW_MS &&
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
