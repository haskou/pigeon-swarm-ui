import type { IdentityResource } from '../types';

import { normalizeIdentityId } from '../../utils/identityId';

function uniqueNetworks(networks: string[]): string[] {
  return [...new Set(networks.filter(Boolean))];
}

function normalizeHandle(handle?: string): string | undefined {
  const normalized = handle?.trim().replace(/^@+/, '').toLowerCase();

  return normalized || undefined;
}

function profileFrom(
  input: IdentityUpdateProfileInput,
): IdentityResource['profile'] {
  // Backend validates JSON.stringify order.
  /* eslint-disable perfectionist/sort-objects */
  return {
    name: input.name,
    handle: normalizeHandle(input.handle),
    biography: input.biography,
    picture: input.picture,
    banner: input.banner,
  };
  /* eslint-enable perfectionist/sort-objects */
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
  public createInitial(input: {
    encryptedKeyPair: IdentityResource['encryptedKeyPair'];
    id: string;
    networks: string[];
    profile: IdentityUpdateProfileInput;
    timestamp: number;
  }): Omit<IdentityResource, 'signature'> {
    return {
      encryptedKeyPair: input.encryptedKeyPair,
      id: normalizeIdentityId(input.id),
      networks: uniqueNetworks(input.networks),
      previousIdentityExternalIdentifier: undefined,
      profile: profileFrom(input.profile),
      timestamp: input.timestamp,
      version: 1,
    };
  }

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
      profile: profileFrom(input.profile),
      timestamp: input.timestamp,
      version: input.identity.version + 1,
    };
  }
}
