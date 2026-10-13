export type DeviceSealedSecretPreimageInput = {
  authorizationRevision: number;
  generation: number;
  identityId: string;
  publisherCredential: string;
  recipientCredential: string;
  sealedSecret: string;
};

/**
 * The string each sealed entry is signed over. The node rebuilds it with
 * alphabetical keys and body-only credentials; both are part of the contract.
 */
export class DeviceSealedSecretPreimage {
  public static readonly PURPOSE = 'pigeon:device-sealed-secret:v1';

  public static of(input: DeviceSealedSecretPreimageInput): string {
    return JSON.stringify({
      authorizationRevision: input.authorizationRevision,
      generation: input.generation,
      identityId: input.identityId,
      publisherCredential: input.publisherCredential,
      purpose: DeviceSealedSecretPreimage.PURPOSE,
      recipientCredential: input.recipientCredential,
      sealedSecret: input.sealedSecret,
    });
  }
}
