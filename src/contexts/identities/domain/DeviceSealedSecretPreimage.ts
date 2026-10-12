export type DeviceSealedSecretPreimageInput = {
  authorizationRevision: number;
  generation: number;
  identityId: string;
  publisherCredential: string;
  recipientCredential: string;
  sealedSecret: string;
};

/**
 * The string each sealed entry is signed over. The node rebuilds it with the
 * same key order, so the order is part of the contract, not a detail.
 */
export class DeviceSealedSecretPreimage {
  public static readonly PURPOSE = 'pigeon:device-sealed-secret:v1';

  public static of(input: DeviceSealedSecretPreimageInput): string {
    /* eslint-disable perfectionist/sort-objects -- signed key order */
    return JSON.stringify({
      purpose: DeviceSealedSecretPreimage.PURPOSE,
      identityId: input.identityId,
      generation: input.generation,
      authorizationRevision: input.authorizationRevision,
      publisherCredential: input.publisherCredential,
      recipientCredential: input.recipientCredential,
      sealedSecret: input.sealedSecret,
    });
    /* eslint-enable perfectionist/sort-objects */
  }
}
