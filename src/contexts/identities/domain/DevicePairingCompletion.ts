import {
  DevicePairingCompletionSignature,
  EncryptedPayload,
  KeyPair,
  PrivateKey,
  Signature,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type { DeviceAuthorizationCheckpoint } from './DeviceAuthorizationCheckpoint';
import type { DevicePairingCompletionPayload } from './DevicePairingCompletionPayload';
import type { DeviceHistoryFloor } from './value-objects/DeviceHistoryFloor';

import { DevicePairingError } from './DevicePairingError';
import { DevicePairingRequest } from './DevicePairingRequest';
import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from './value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { DevicePairingCode } from './value-objects/DevicePairingCode';
import { IdentityId } from './value-objects/IdentityId';
import { PairingId } from './value-objects/PairingId';

const KIND = 'pigeon-device-pairing-completion';

export class DevicePairingCompletion {
  private readonly authorCredential: DeviceCredential;
  private readonly encryptedMaterial: EncryptedPayload;
  private readonly epoch: DeviceAuthorizationEpoch;
  private readonly identityId: IdentityId;
  private readonly operationId: DeviceAuthorizationOperationId;
  private readonly pairingId: PairingId;
  private readonly revision: DeviceAuthorizationRevision;
  private readonly signature: Signature;

  public static create(input: {
    author: KeyPair;
    checkpoint: DeviceAuthorizationCheckpoint;
    historyFloor: DeviceHistoryFloor;
    historyTransferSecret: SymmetricKey;
    identityKeyPair: KeyPair;
    recoveryAuthorityKeyPair: KeyPair;
    request: DevicePairingRequest;
    rootKey: UserRootKey;
  }): DevicePairingCompletion {
    const encryptedMaterial = input.request
      .getTransportPublicKey()
      .getPublicKey()
      .encrypt(
        JSON.stringify({
          historyFloor: input.historyFloor.toPrimitives(),
          historyTransferSecret: input.historyTransferSecret.valueOf(),
          identityKeyPair: input.identityKeyPair.toPrimitives(),
          recoveryAuthorityKeyPair:
            input.recoveryAuthorityKeyPair.toPrimitives(),
          rootKey: input.rootKey.valueOf(),
          version: 1,
        }),
      );
    const invitation = input.request.getInvitation();
    const payload: DevicePairingCompletionPayload = {
      authorCredential: invitation.getAuthorCredential().valueOf(),
      encryptedMaterial: encryptedMaterial.valueOf(),
      epoch: input.checkpoint.getEpoch().valueOf(),
      identityId: input.checkpoint.getIdentityId().valueOf(),
      operationId: input.request.getOperationId().valueOf(),
      pairingId: invitation.getPairingId().valueOf(),
      revision: input.checkpoint.getRevision().valueOf(),
      version: 1,
    };

    return new DevicePairingCompletion({
      authorCredential: DeviceCredential.fromString(payload.authorCredential),
      encryptedMaterial: new EncryptedPayload(payload.encryptedMaterial),
      epoch: input.checkpoint.getEpoch(),
      identityId: input.checkpoint.getIdentityId(),
      operationId: input.request.getOperationId(),
      pairingId: invitation.getPairingId(),
      revision: input.checkpoint.getRevision(),
      signature: DevicePairingCompletionSignature.sign(
        payload,
        new PrivateKey(input.author.toPrimitives().privateKey),
      ),
    });
  }

  public static restore(state: {
    authorCredential: DeviceCredential;
    encryptedMaterial: EncryptedPayload;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    pairingId: PairingId;
    revision: DeviceAuthorizationRevision;
    signature: Signature;
  }): DevicePairingCompletion {
    return new DevicePairingCompletion(state);
  }

  private constructor(state: {
    authorCredential: DeviceCredential;
    encryptedMaterial: EncryptedPayload;
    epoch: DeviceAuthorizationEpoch;
    identityId: IdentityId;
    operationId: DeviceAuthorizationOperationId;
    pairingId: PairingId;
    revision: DeviceAuthorizationRevision;
    signature: Signature;
  }) {
    this.authorCredential = state.authorCredential;
    this.encryptedMaterial = state.encryptedMaterial;
    this.epoch = state.epoch;
    this.identityId = state.identityId;
    this.operationId = state.operationId;
    this.pairingId = state.pairingId;
    this.revision = state.revision;
    this.signature = state.signature;
  }

  private payload(): DevicePairingCompletionPayload {
    return {
      authorCredential: this.authorCredential.valueOf(),
      encryptedMaterial: this.encryptedMaterial.valueOf(),
      epoch: this.epoch.valueOf(),
      identityId: this.identityId.valueOf(),
      operationId: this.operationId.valueOf(),
      pairingId: this.pairingId.valueOf(),
      revision: this.revision.valueOf(),
      version: 1,
    };
  }

  private isSignedByAuthor(): boolean {
    try {
      DevicePairingCompletionSignature.verify(
        this.payload(),
        this.signature,
        this.authorCredential.getPublicKey(),
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verifies the completion against the pending request and returns the
   * decrypted material plaintext.
   */
  public decryptMaterial(
    request: DevicePairingRequest,
    transport: KeyPair,
  ): string {
    const invitation = request.getInvitation();

    assert(
      this.authorCredential.isEqual(invitation.getAuthorCredential()) &&
        this.identityId.isEqual(invitation.getIdentityId()) &&
        this.operationId.isEqual(request.getOperationId()) &&
        this.pairingId.isEqual(invitation.getPairingId()) &&
        this.revision.isEqual(invitation.getRevision().add(1)) &&
        this.epoch.isEqual(invitation.getEpoch()) &&
        this.isSignedByAuthor(),
      new DevicePairingError('invalid', 'Invalid device pairing completion.'),
    );

    return transport.decrypt(this.encryptedMaterial).toString();
  }

  public getEpoch(): DeviceAuthorizationEpoch {
    return this.epoch;
  }

  public getIdentityId(): IdentityId {
    return this.identityId;
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
