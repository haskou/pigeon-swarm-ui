import type { IdentityResource } from '../types';

import { normalizeIdentityId } from '../../utils/identityId';

function uniqueNetworks(networks: string[]): string[] {
  return [...new Set(networks.filter(Boolean))];
}

export type IdentityUpdateProfileInput = {
  banner?: string;
  biography?: string;
  handle?: string;
  name: string;
  networks?: string[];
  picture?: string;
};

export class IdentitySignaturePayloadFactory {
  public createUpdate(input: {
    encryptedKeyPair?: IdentityResource['encryptedKeyPair'];
    identity: IdentityResource;
    previousIdentityExternalIdentifier?: string;
    profile: IdentityUpdateProfileInput;
    timestamp: number;
  }): Omit<IdentityResource, 'signature'> {
    return {
      encryptedKeyPair:
        input.encryptedKeyPair ?? input.identity.encryptedKeyPair,
      id: normalizeIdentityId(input.identity.id),
      networks: uniqueNetworks([
        ...input.identity.networks,
        ...(input.profile.networks ?? []),
      ]),
      previousIdentityExternalIdentifier:
        input.previousIdentityExternalIdentifier,
      profile: {
        banner: input.profile.banner,
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
