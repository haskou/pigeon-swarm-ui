import {
  EncryptedPayload,
  KeyPair,
  Signature,
} from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type {
  DeviceSealedSecretEntryResource,
  DeviceSealedSecretResource,
} from '../http/resources/DeviceSealedSecretResource';

import { DeviceSealedSecretPreimage } from '../../domain/DeviceSealedSecretPreimage';
import { DeviceCredential } from '../../domain/value-objects/DeviceCredential';

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

  public static seal(
    input: DeviceSealedSecretSealInput,
  ): DeviceSealedSecretEntryResource[] {
    assert(
      input.recipients.length >= 1 &&
        input.recipients.length <= DeviceSealedSecretCipher.MAX_RECIPIENTS,
      new Error('Device sealed secret needs between 1 and 128 recipients.'),
    );

    const publisherCredential = DeviceCredential.fromString(
      input.publisher.toPrimitives().publicKey,
    ).valueOf();

    return input.recipients.map((recipient) => {
      const recipientCredential = recipient.valueOf();
      const sealedSecret = recipient
        .getPublicKey()
        .encrypt(input.payload)
        .valueOf();
      const preimage = DeviceSealedSecretPreimage.of({
        authorizationRevision: input.authorizationRevision,
        generation: input.generation,
        identityId: input.identityId,
        publisherCredential,
        recipientCredential,
        sealedSecret,
      });

      return {
        recipientCredential,
        sealedSecret,
        signature: input.publisher.sign(preimage).toString(),
      };
    });
  }

  public static open(input: {
    identityId: string;
    recipient: KeyPair;
    resource: DeviceSealedSecretResource;
  }): OpenedDeviceSealedSecret {
    const { resource } = input;
    const recipientCredential = DeviceCredential.fromString(
      input.recipient.toPrimitives().publicKey,
    ).valueOf();

    assert(
      resource.identityId === input.identityId &&
        resource.recipientCredential === recipientCredential,
      new Error('Device sealed secret is not addressed to this device.'),
    );

    const preimage = DeviceSealedSecretPreimage.of({
      authorizationRevision: resource.authorizationRevision,
      generation: resource.generation,
      identityId: resource.identityId,
      publisherCredential: resource.publisherCredential,
      recipientCredential: resource.recipientCredential,
      sealedSecret: resource.sealedSecret,
    });

    assert(
      DeviceCredential.fromString(resource.publisherCredential)
        .getPublicKey()
        .isValidSignature(preimage, new Signature(resource.signature)),
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
