import type { IdentityResource } from '../types';

import { normalizeIdentityId } from '../../utils/identityId';
import { ProfileBiography } from './profile/ProfileBiography';
import { ProfileHandle } from './profile/ProfileHandle';
import { ProfileName } from './profile/ProfileName';

function uniqueNetworks(networks: string[]): string[] {
  return [...new Set(networks.filter(Boolean))];
}

function normalizeHandle(handle?: string): string | undefined {
  const normalized = handle?.trim().replace(/^@+/, '');

  return normalized ? new ProfileHandle(normalized).valueOf() : undefined;
}

function normalizeBiography(biography?: string): string | undefined {
  const normalized = biography?.trim();

  return normalized ? new ProfileBiography(normalized).valueOf() : undefined;
}

function profileFrom(
  input: IdentityUpdateProfileInput,
): IdentityResource['profile'] {
  // Backend validates JSON.stringify order.
  /* eslint-disable perfectionist/sort-objects */
  return {
    banner: input.banner,
    biography: normalizeBiography(input.biography),
    handle: normalizeHandle(input.handle),
    name: new ProfileName(input.name.trim()).valueOf(),
    picture: input.picture,
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
