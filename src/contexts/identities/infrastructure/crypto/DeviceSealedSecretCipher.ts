import {
  DeviceSealedSecretSignature,
  EncryptedPayload,
  KeyPair,
  PrivateKey,
  Signature,
} from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type {
  DeviceSealedSecretEntryResource,
  DeviceSealedSecretResource,
} from '../http/resources/DeviceSealedSecretResource';

import { DeviceCredential } from '../../domain/value-objects/DeviceCredential';
import { IdentityId } from '../../domain/value-objects/IdentityId';

export type OpenedDeviceSealedSecret = {
  authorizationRevision: number;
  generation: number;
  payload: string;
};

export type DeviceSealedSecretSealInput = {
  authorizationRevision: number;
  generation: number;
  identityId: string;
  payload: string;
  publisher: KeyPair;
  recipients: readonly DeviceCredential[];
};

/**
 * Seals one generation of device secrets: the payload is encrypted to each
 * recipient device credential and every entry is signed by the publishing
 * device. Opening verifies the signature before decrypting, so a recipient
 * trusts the entry only as far as the publisher's device key. The payload
 * never leaves this module in clear text except to its recipient.
 */
export class DeviceSealedSecretCipher {
  private static readonly MAX_RECIPIENTS = 128;

  /**
   * The body-only base64 form the node stores and verifies. PEM headers and
   * whitespace are not part of it, so credentials are sent and signed in it.
   */
  private static credentialBody(credential: DeviceCredential): string {
    return IdentityId.fromString(credential.valueOf()).valueOf();
  }

  private static isSignedByPublisher(
    resource: DeviceSealedSecretResource,
  ): boolean {
    try {
      DeviceSealedSecretSignature.verify(
        {
          authorizationRevision: resource.authorizationRevision,
          generation: resource.generation,
          identityId: resource.identityId,
          publisherCredential: resource.publisherCredential,
          recipientCredential: resource.recipientCredential,
          sealedSecret: resource.sealedSecret,
        },
        new Signature(resource.signature),
        IdentityId.fromString(resource.publisherCredential).getPublicKey(),
      );

      return true;
    } catch {
      return false;
    }
  }

  public static seal(
    input: DeviceSealedSecretSealInput,
  ): DeviceSealedSecretEntryResource[] {
    assert(
      input.recipients.length >= 1 &&
        input.recipients.length <= DeviceSealedSecretCipher.MAX_RECIPIENTS,
      new Error('Device sealed secret needs between 1 and 128 recipients.'),
    );

    const publisherCredential = DeviceSealedSecretCipher.credentialBody(
      DeviceCredential.fromString(input.publisher.toPrimitives().publicKey),
    );

    return input.recipients.map((recipient) => {
      const recipientCredential =
        DeviceSealedSecretCipher.credentialBody(recipient);
      const sealedSecret = recipient
        .getPublicKey()
        .encrypt(input.payload)
        .valueOf();
      const signature = DeviceSealedSecretSignature.sign(
        {
          authorizationRevision: input.authorizationRevision,
          generation: input.generation,
          identityId: input.identityId,
          publisherCredential,
          recipientCredential,
          sealedSecret,
        },
        new PrivateKey(input.publisher.toPrimitives().privateKey),
      );

      return {
        recipientCredential,
        sealedSecret,
        signature: signature.toString(),
      };
    });
  }

  public static open(input: {
    identityId: string;
    recipient: KeyPair;
    resource: DeviceSealedSecretResource;
  }): OpenedDeviceSealedSecret {
    const { resource } = input;
    const recipientCredential = DeviceSealedSecretCipher.credentialBody(
      DeviceCredential.fromString(input.recipient.toPrimitives().publicKey),
    );

    assert(
      resource.identityId === input.identityId &&
        resource.recipientCredential === recipientCredential,
      new Error('Device sealed secret is not addressed to this device.'),
    );

    assert(
      DeviceSealedSecretCipher.isSignedByPublisher(resource),
      new Error('Invalid device sealed secret signature.'),
    );

    return {
      authorizationRevision: resource.authorizationRevision,
      generation: resource.generation,
      payload: input.recipient
        .decrypt(new EncryptedPayload(resource.sealedSecret))
        .toString('utf8'),
    };
  }
}
