import {
  EncryptedPayload,
  KeyPair,
  Signature,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp, assert } from '@haskou/value-objects';

import type { DevicePairingCompletionMaterialResource } from './resources/DevicePairingCompletionMaterialResource';
import type { DevicePairingCompletionResource } from './resources/DevicePairingCompletionResource';
import type { DevicePairingInvitationResource } from './resources/DevicePairingInvitationResource';
import type { DevicePairingRequestResource } from './resources/DevicePairingRequestResource';

import { DeviceAuthorizationEnrollmentProof } from '../../domain/DeviceAuthorizationEnrollmentProof';
import { DevicePairingCompletion } from '../../domain/DevicePairingCompletion';
import { DevicePairingError } from '../../domain/DevicePairingError';
import { DevicePairingInvitation } from '../../domain/DevicePairingInvitation';
import { DevicePairingMaterial } from '../../domain/DevicePairingMaterial';
import { DevicePairingRequest } from '../../domain/DevicePairingRequest';
import { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import { DeviceHistoryFloor } from '../../domain/value-objects/DeviceHistoryFloor';
import { DevicePairingCode } from '../../domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { PairingId } from '../../domain/value-objects/PairingId';
import { PairingTransportPublicKey } from '../../domain/value-objects/PairingTransportPublicKey';
import { DevicePairingResource } from './DevicePairingResource';

/** Reads untrusted device pairing codes and material into domain objects. */
export class DevicePairingCodeReader {
  private static completionResource(
    code: DevicePairingCode,
  ): DevicePairingCompletionResource {
    const resource = DevicePairingResource.fromUnknown(
      code.decode(),
      'Invalid device pairing completion.',
    );
    resource.assertProtocol('pigeon-device-pairing-completion', 1);

    return {
      authorCredential: resource.getString('authorCredential'),
      encryptedMaterial: resource.getString('encryptedMaterial'),
      epoch: resource.getString('epoch'),
      identityId: resource.getString('identityId'),
      kind: 'pigeon-device-pairing-completion',
      operationId: resource.getString('operationId'),
      pairingId: resource.getString('pairingId'),
      revision: resource.getNumber('revision'),
      signature: resource.getString('signature'),
      version: 1,
    };
  }

  private static invitationResource(
    code: DevicePairingCode,
  ): DevicePairingInvitationResource {
    const resource = DevicePairingResource.fromUnknown(
      code.decode(),
      'Invalid device pairing invitation.',
    );
    resource.assertProtocol('pigeon-device-pairing-invitation', 1);

    return {
      authorCredential: resource.getString('authorCredential'),
      epoch: resource.getString('epoch'),
      expiresAt: resource.getNumber('expiresAt'),
      identityId: resource.getString('identityId'),
      kind: 'pigeon-device-pairing-invitation',
      pairingId: resource.getString('pairingId'),
      revision: resource.getNumber('revision'),
      signature: resource.getString('signature'),
      version: 1,
    };
  }

  private static materialResource(
    plaintext: string,
    acceptedAt: Timestamp,
  ): DevicePairingCompletionMaterialResource {
    const invalidMessage = 'Invalid encrypted device pairing material.';
    const resource = DevicePairingResource.fromUnknown(
      JSON.parse(plaintext) as unknown,
      invalidMessage,
    );
    assert(
      resource.getNumber('version') === 1,
      new DevicePairingError('invalid', invalidMessage),
    );
    const historyFloor = resource.getNumber('historyFloor');
    assert(
      DeviceHistoryFloor.isReceivable(historyFloor, acceptedAt),
      new DevicePairingError('invalid', invalidMessage),
    );

    return {
      historyFloor,
      historyTransferSecret: resource.getString('historyTransferSecret'),
      identityKeyPair: resource.getKeyPair('identityKeyPair'),
      recoveryAuthorityKeyPair: resource.getKeyPair('recoveryAuthorityKeyPair'),
      rootKey: resource.getString('rootKey'),
      version: 1,
    };
  }

  private static requestResource(
    code: DevicePairingCode,
  ): DevicePairingRequestResource {
    const resource = DevicePairingResource.fromUnknown(
      code.decode(),
      'Invalid device pairing request.',
    );
    resource.assertProtocol('pigeon-device-pairing-request', 1);

    return {
      authorizedAt: resource.getNumber('authorizedAt'),
      invitation: resource.getString('invitation'),
      kind: 'pigeon-device-pairing-request',
      operationId: resource.getString('operationId'),
      proofOfPossession: resource.getString('proofOfPossession'),
      signature: resource.getString('signature'),
      targetCredential: resource.getString('targetCredential'),
      transportPublicKey: resource.getString('transportPublicKey'),
      version: 1,
    };
  }

  public static completion(code: DevicePairingCode): DevicePairingCompletion {
    const resource = this.completionResource(code);

    return DevicePairingCompletion.restore({
      authorCredential: DeviceCredential.fromString(resource.authorCredential),
      encryptedMaterial: new EncryptedPayload(resource.encryptedMaterial),
      epoch: DeviceAuthorizationEpoch.fromString(resource.epoch),
      identityId: IdentityId.fromString(resource.identityId),
      operationId: DeviceAuthorizationOperationId.fromString(
        resource.operationId,
      ),
      pairingId: PairingId.fromString(resource.pairingId),
      revision: DeviceAuthorizationRevision.fromNumber(resource.revision),
      signature: new Signature(resource.signature),
    });
  }

  public static invitation(
    code: DevicePairingCode,
    acceptedAt: Timestamp,
  ): DevicePairingInvitation {
    const resource = this.invitationResource(code);

    return DevicePairingInvitation.restore(
      {
        authorCredential: DeviceCredential.fromString(
          resource.authorCredential,
        ),
        epoch: DeviceAuthorizationEpoch.fromString(resource.epoch),
        expiresAt: new Timestamp(resource.expiresAt),
        identityId: IdentityId.fromString(resource.identityId),
        pairingId: PairingId.fromString(resource.pairingId),
        revision: DeviceAuthorizationRevision.fromNumber(resource.revision),
        signature: new Signature(resource.signature),
      },
      acceptedAt,
    );
  }

  /** Refuses a history floor `acceptedAt` cannot have reached yet. */
  public static material(
    plaintext: string,
    acceptedAt: Timestamp,
  ): DevicePairingMaterial {
    const resource = this.materialResource(plaintext, acceptedAt);

    return new DevicePairingMaterial(
      KeyPair.fromPrimitives(resource.identityKeyPair),
      KeyPair.fromPrimitives(resource.recoveryAuthorityKeyPair),
      UserRootKey.fromBase64(resource.rootKey),
      SymmetricKey.fromBase64(resource.historyTransferSecret),
      DeviceHistoryFloor.fromPrimitives(resource.historyFloor),
    );
  }

  public static request(
    code: DevicePairingCode,
    acceptedAt: Timestamp,
  ): DevicePairingRequest {
    const resource = this.requestResource(code);

    return DevicePairingRequest.restore(
      {
        authorizedAt: new Timestamp(resource.authorizedAt),
        invitation: this.invitation(
          DevicePairingCode.fromString(resource.invitation),
          acceptedAt,
        ),
        operationId: DeviceAuthorizationOperationId.fromString(
          resource.operationId,
        ),
        proof: new DeviceAuthorizationEnrollmentProof(
          DeviceCredential.fromString(resource.targetCredential),
          new Signature(resource.proofOfPossession),
        ),
        signature: new Signature(resource.signature),
        transportPublicKey: PairingTransportPublicKey.fromString(
          resource.transportPublicKey,
        ),
      },
      acceptedAt,
    );
  }
}
