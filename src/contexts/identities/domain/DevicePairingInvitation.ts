import { KeyPair, Signature } from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import type { DevicePairingInvitationPayload } from './DevicePairingInvitationPayload';

import { DevicePairingError } from './DevicePairingError';
import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { DevicePairingCode } from './value-objects/DevicePairingCode';
import { IdentityId } from './value-objects/IdentityId';
import { PairingId } from './value-objects/PairingId';

const DOMAIN = 'pigeon:device-pairing:invitation:v1';
const KIND = 'pigeon-device-pairing-invitation';

export class DevicePairingInvitation {
  /** Restores an invitation read from a code; it must verify when accepted. */
  public static restore(
    state: {
      authorCredential: DeviceCredential;
      epoch: DeviceAuthorizationEpoch;
      expiresAt: Timestamp;
      identityId: IdentityId;
      pairingId: PairingId;
      revision: DeviceAuthorizationRevision;
      signature: Signature;
    },
    acceptedAt: Timestamp,
  ): DevicePairingInvitation {
    const invitation = new DevicePairingInvitation(
      state.authorCredential,
      state.epoch,
      state.expiresAt,
      state.identityId,
      state.pairingId,
      state.revision,
      state.signature,
    );

    invitation.assertValidAt(acceptedAt);

    return invitation;
  }

  public static create(input: {
    author: KeyPair;
    epoch: DeviceAuthorizationEpoch;
    expiresAt: Timestamp;
    identityId: IdentityId;
    pairingId: PairingId;
    revision: DeviceAuthorizationRevision;
  }): DevicePairingInvitation {
    const payload: DevicePairingInvitationPayload = {
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

  private constructor(
    private readonly authorCredential: DeviceCredential,
    private readonly epoch: DeviceAuthorizationEpoch,
    private readonly expiresAt: Timestamp,
    private readonly identityId: IdentityId,
    private readonly pairingId: PairingId,
    private readonly revision: DeviceAuthorizationRevision,
    private readonly signature: Signature,
  ) {}

  private payload(): DevicePairingInvitationPayload {
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
      this.authorCredential
        .getPublicKey()
        .isValidSignature(
          JSON.stringify({ domain: DOMAIN, invitation: this.payload() }),
          this.signature,
        ),
      new DevicePairingError('invalid', 'Invalid device pairing invitation.'),
    );
    assert(
      acceptedAt.valueOf() <= this.expiresAt.valueOf(),
      new DevicePairingError('expired', 'Expired device pairing invitation.'),
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
