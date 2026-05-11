import type { IdentityResource } from '../types';

export type IdentityUpdateProfileInput = {
  biography?: string;
  handle?: string;
  name: string;
  picture?: string;
};

export class IdentitySignaturePayloadFactory {
  public createUpdate(input: {
    identity: IdentityResource;
    previousIdentityExternalIdentifier: string;
    profile: IdentityUpdateProfileInput;
    timestamp: number;
  }): Omit<IdentityResource, 'signature'> {
    return {
      encryptedKeyPair: input.identity.encryptedKeyPair,
      id: input.identity.id,
      networks: input.identity.networks,
      previousIdentityExternalIdentifier:
        input.previousIdentityExternalIdentifier,
      profile: {
        biography: input.profile.biography,
        handle: input.profile.handle,
        name: input.profile.name,
        picture: input.profile.picture,
      },
      timestamp: input.timestamp,
      version: input.identity.version + 1,
    };
  }
}
