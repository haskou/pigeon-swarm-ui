import { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import { DevicePairingResource } from './DevicePairingResource';
import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { DevicePairingCode } from './value-objects/DevicePairingCode';
import { IdentityId } from './value-objects/IdentityId';
import { PairingId } from './value-objects/PairingId';

const DOMAIN = 'pigeon:device-pairing:invitation:v1';
const KIND = 'pigeon-device-pairing-invitation';

type InvitationPayload = {
  authorCredential: string;
  epoch: string;
  expiresAt: number;
  identityId: string;
  pairingId: string;
  revision: number;
  version: 1;
};

type InvitationResource = InvitationPayload & {
  kind: typeof KIND;
  signature: string;
};

export class DevicePairingInvitation {
  public static create(input: {
    author: KeyPair;
    epoch: DeviceAuthorizationEpoch;
    expiresAt: Timestamp;
    identityId: IdentityId;
    pairingId: PairingId;
    revision: DeviceAuthorizationRevision;
  }): DevicePairingInvitation {
    const payload: InvitationPayload = {
      authorCredential: input.author.toPrimitives().publicKey,
      epoch: input.epoch.valueOf(),
      expiresAt: input.expiresAt.valueOf(),
      identityId: input.identityId.valueOf(),
      pairingId: input.pairingId.valueOf(),
      revision: input.revision.valueOf(),
      version: 1,
    };

    return new DevicePairingInvitation(
      DeviceCredential.fromString(payload.authorCredential),
      input.epoch,
      input.expiresAt,
      input.identityId,
      input.pairingId,
      input.revision,
      input.author.sign(
        JSON.stringify({ domain: DOMAIN, invitation: payload }),
      ),
    );
  }

  public static fromCode(
    code: DevicePairingCode,
    acceptedAt: Timestamp,
  ): DevicePairingInvitation {
    const resource = this.resource(code.decode());
    const invitation = new DevicePairingInvitation(
      DeviceCredential.fromString(resource.authorCredential),
      DeviceAuthorizationEpoch.fromString(resource.epoch),
      new Timestamp(resource.expiresAt),
      IdentityId.fromString(resource.identityId),
      PairingId.fromString(resource.pairingId),
      DeviceAuthorizationRevision.fromNumber(resource.revision),
      new Signature(resource.signature),
    );

    invitation.assertValidAt(acceptedAt);

    return invitation;
  }

  private static resource(value: unknown): InvitationResource {
    const resource = DevicePairingResource.fromUnknown(
      value,
      'Invalid device pairing invitation.',
    );
    resource.assertProtocol(KIND, 1);

    return {
      authorCredential: resource.getString('authorCredential'),
      epoch: resource.getString('epoch'),
      expiresAt: resource.getNumber('expiresAt'),
      identityId: resource.getString('identityId'),
      kind: KIND,
      pairingId: resource.getString('pairingId'),
      revision: resource.getNumber('revision'),
      signature: resource.getString('signature'),
      version: 1,
    };
  }

  private constructor(
    private readonly authorCredential: DeviceCredential,
    private readonly epoch: DeviceAuthorizationEpoch,
    private readonly expiresAt: Timestamp,
    private readonly identityId: IdentityId,
    private readonly pairingId: PairingId,
    private readonly revision: DeviceAuthorizationRevision,
    private readonly signature: Signature,
  ) {}

  private payload(): InvitationPayload {
    return {
      authorCredential: this.authorCredential.valueOf(),
      epoch: this.epoch.valueOf(),
      expiresAt: this.expiresAt.valueOf(),
      identityId: this.identityId.valueOf(),
      pairingId: this.pairingId.valueOf(),
      revision: this.revision.valueOf(),
      version: 1,
    };
  }

  public assertValidAt(acceptedAt: Timestamp): void {
    assert(
      acceptedAt.valueOf() <= this.expiresAt.valueOf() &&
        this.authorCredential
          .getPublicKey()
          .isValidSignature(
            JSON.stringify({ domain: DOMAIN, invitation: this.payload() }),
            this.signature,
          ),
      new Error('Invalid or expired device pairing invitation.'),
    );
  }

  public getAuthorCredential(): DeviceCredential {
    return this.authorCredential;
  }

  public getEpoch(): DeviceAuthorizationEpoch {
    return this.epoch;
  }

  public getExpiration(): Timestamp {
    return this.expiresAt;
  }

  public getIdentityId(): IdentityId {
    return this.identityId;
  }

  public getPairingId(): PairingId {
    return this.pairingId;
  }

  public getRevision(): DeviceAuthorizationRevision {
    return this.revision;
  }

  public toCode(): DevicePairingCode {
    return DevicePairingCode.encode({
      kind: KIND,
      ...this.payload(),
      signature: this.signature.valueOf(),
    });
  }
}
