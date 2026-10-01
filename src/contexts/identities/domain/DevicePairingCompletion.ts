import {
  EncryptedPayload,
  KeyPair,
  Signature,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type { DeviceAuthorizationCheckpoint } from './DeviceAuthorizationCheckpoint';

import { DevicePairingMaterial } from './DevicePairingMaterial';
import { DevicePairingRequest } from './DevicePairingRequest';
import { DevicePairingResource } from './DevicePairingResource';
import { DeviceAuthorizationEpoch } from './value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from './value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from './value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from './value-objects/DeviceCredential';
import { DevicePairingCode } from './value-objects/DevicePairingCode';
import { IdentityId } from './value-objects/IdentityId';
import { PairingId } from './value-objects/PairingId';

const DOMAIN = 'pigeon:device-pairing:completion:v1';
const KIND = 'pigeon-device-pairing-completion';

type MaterialResource = {
  identityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  recoveryAuthorityKeyPair: ReturnType<KeyPair['toPrimitives']>;
  rootKey: string;
  version: 1;
};

type CompletionPayload = {
  authorCredential: string;
  encryptedMaterial: string;
  epoch: string;
  identityId: string;
  operationId: string;
  pairingId: string;
  revision: number;
  version: 1;
};

type CompletionResource = CompletionPayload & {
  kind: typeof KIND;
  signature: string;
};

export class DevicePairingCompletion {
  public static create(input: {
    author: KeyPair;
    checkpoint: DeviceAuthorizationCheckpoint;
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
          identityKeyPair: input.identityKeyPair.toPrimitives(),
          recoveryAuthorityKeyPair:
            input.recoveryAuthorityKeyPair.toPrimitives(),
          rootKey: input.rootKey.valueOf(),
          version: 1,
        } satisfies MaterialResource),
      );
    const invitation = input.request.getInvitation();
    const payload: CompletionPayload = {
      authorCredential: invitation.getAuthorCredential().valueOf(),
      encryptedMaterial: encryptedMaterial.valueOf(),
      epoch: input.checkpoint.getEpoch().valueOf(),
      identityId: input.checkpoint.getIdentityId().valueOf(),
      operationId: input.request.getOperationId().valueOf(),
      pairingId: invitation.getPairingId().valueOf(),
      revision: input.checkpoint.getRevision().valueOf(),
      version: 1,
    };

    return new DevicePairingCompletion(
      DeviceCredential.fromString(payload.authorCredential),
      new EncryptedPayload(payload.encryptedMaterial),
      input.checkpoint.getEpoch(),
      input.checkpoint.getIdentityId(),
      input.request.getOperationId(),
      invitation.getPairingId(),
      input.checkpoint.getRevision(),
      input.author.sign(
        JSON.stringify({ completion: payload, domain: DOMAIN }),
      ),
    );
  }

  public static fromCode(code: DevicePairingCode): DevicePairingCompletion {
    const resource = this.resource(code.decode());

    return new DevicePairingCompletion(
      DeviceCredential.fromString(resource.authorCredential),
      new EncryptedPayload(resource.encryptedMaterial),
      DeviceAuthorizationEpoch.fromString(resource.epoch),
      IdentityId.fromString(resource.identityId),
      DeviceAuthorizationOperationId.fromString(resource.operationId),
      PairingId.fromString(resource.pairingId),
      DeviceAuthorizationRevision.fromNumber(resource.revision),
      new Signature(resource.signature),
    );
  }

  private static resource(value: unknown): CompletionResource {
    const resource = DevicePairingResource.fromUnknown(
      value,
      'Invalid device pairing completion.',
    );
    resource.assertProtocol(KIND, 1);

    return {
      authorCredential: resource.getString('authorCredential'),
      encryptedMaterial: resource.getString('encryptedMaterial'),
      epoch: resource.getString('epoch'),
      identityId: resource.getString('identityId'),
      kind: KIND,
      operationId: resource.getString('operationId'),
      pairingId: resource.getString('pairingId'),
      revision: resource.getNumber('revision'),
      signature: resource.getString('signature'),
      version: 1,
    };
  }

  private constructor(
    private readonly authorCredential: DeviceCredential,
    private readonly encryptedMaterial: EncryptedPayload,
    private readonly epoch: DeviceAuthorizationEpoch,
    private readonly identityId: IdentityId,
    private readonly operationId: DeviceAuthorizationOperationId,
    private readonly pairingId: PairingId,
    private readonly revision: DeviceAuthorizationRevision,
    private readonly signature: Signature,
  ) {}

  private payload(): CompletionPayload {
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

  private material(value: unknown): DevicePairingMaterial {
    const resource = DevicePairingResource.fromUnknown(
      value,
      'Invalid encrypted device pairing material.',
    );
    assert(
      resource.getNumber('version') === 1,
      new Error('Invalid encrypted device pairing material.'),
    );

    return new DevicePairingMaterial(
      KeyPair.fromPrimitives(resource.getKeyPair('identityKeyPair')),
      KeyPair.fromPrimitives(resource.getKeyPair('recoveryAuthorityKeyPair')),
      UserRootKey.fromBase64(resource.getString('rootKey')),
    );
  }

  public open(
    request: DevicePairingRequest,
    transport: KeyPair,
  ): DevicePairingMaterial {
    const invitation = request.getInvitation();

    assert(
      this.authorCredential.isEqual(invitation.getAuthorCredential()) &&
        this.identityId.isEqual(invitation.getIdentityId()) &&
        this.operationId.isEqual(request.getOperationId()) &&
        this.pairingId.isEqual(invitation.getPairingId()) &&
        this.revision.valueOf() === invitation.getRevision().valueOf() + 1 &&
        this.epoch.isEqual(invitation.getEpoch()) &&
        this.authorCredential
          .getPublicKey()
          .isValidSignature(
            JSON.stringify({ completion: this.payload(), domain: DOMAIN }),
            this.signature,
          ),
      new Error('Invalid device pairing completion.'),
    );

    const plaintext = transport.decrypt(this.encryptedMaterial).toString();

    return this.material(JSON.parse(plaintext) as unknown);
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
