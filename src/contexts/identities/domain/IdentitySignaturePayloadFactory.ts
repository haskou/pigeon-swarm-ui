import type { IdentityUpdateProfileInput } from './IdentityUpdateProfileInput';

export type { IdentityUpdateProfileInput } from './IdentityUpdateProfileInput';
import type { IdentityResource } from '../../../shared/domain/pigeonResources.types';

import { ProfileBiography } from './profile/ProfileBiography';
import { ProfileHandle } from './profile/ProfileHandle';
import { ProfileName } from './profile/ProfileName';
import { IdentityId } from './value-objects/IdentityId';

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

export class IdentitySignaturePayloadFactory {
  public createInitial(input: {
    encryptedKeyPair: IdentityResource['encryptedKeyPair'];
    encryptedMasterKey: string;
    id: string;
    masterKeyDerivation: IdentityResource['masterKeyDerivation'];
    networks: string[];
    profile: IdentityUpdateProfileInput;
    timestamp: number;
  }): Omit<IdentityResource, 'signature'> {
    return {
      encryptedKeyPair: input.encryptedKeyPair,
      encryptedMasterKey: input.encryptedMasterKey,
      id: IdentityId.normalize(input.id),
      masterKeyDerivation: input.masterKeyDerivation,
      networks: uniqueNetworks(input.networks),
      previousIdentityExternalIdentifier: undefined,
      profile: profileFrom(input.profile),
      timestamp: input.timestamp,
      version: 1,
    };
  }

  public createUpdate(input: {
    encryptedKeyPair?: IdentityResource['encryptedKeyPair'];
    encryptedMasterKey?: string;
    identity: IdentityResource;
    masterKeyDerivation?: IdentityResource['masterKeyDerivation'];
    previousIdentityExternalIdentifier?: string;
    profile: IdentityUpdateProfileInput;
    timestamp: number;
  }): Omit<IdentityResource, 'signature'> {
    return {
      encryptedKeyPair:
        input.encryptedKeyPair ?? input.identity.encryptedKeyPair,
      encryptedMasterKey:
        input.encryptedMasterKey ?? input.identity.encryptedMasterKey,
      id: IdentityId.normalize(input.identity.id),
      masterKeyDerivation:
        input.masterKeyDerivation ?? input.identity.masterKeyDerivation,
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
