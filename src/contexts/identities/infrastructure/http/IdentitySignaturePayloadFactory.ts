import type { IdentityUpdateProfileInput } from './resources/IdentityUpdateProfileInput';

export type { IdentityUpdateProfileInput } from './resources/IdentityUpdateProfileInput';
import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { ProfileBiography } from '../../domain/profile/ProfileBiography';
import { ProfileHandle } from '../../domain/profile/ProfileHandle';
import { ProfileName } from '../../domain/profile/ProfileName';
import { IdentityId } from '../../domain/value-objects/IdentityId';

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
    deviceCredential: string;
    deviceCredentialCommitment: string;
    id: string;
    networks: string[];
    profile: IdentityUpdateProfileInput;
    recoveryAuthority: string;
    timestamp: number;
  }): Omit<IdentityResource, 'signature'> {
    return {
      authorizationRevision: 0,
      deviceCredential: input.deviceCredential,
      deviceCredentialCommitment: input.deviceCredentialCommitment,
      id: IdentityId.normalize(input.id),
      networks: uniqueNetworks(input.networks),
      previousIdentityExternalIdentifier: undefined,
      profile: profileFrom(input.profile),
      recoveryAuthority: input.recoveryAuthority,
      timestamp: input.timestamp,
      version: 1,
    };
  }

  public createUpdate(input: {
    identity: IdentityResource;
    previousIdentityExternalIdentifier?: string;
    profile: IdentityUpdateProfileInput;
    timestamp: number;
  }): Omit<IdentityResource, 'signature'> {
    return {
      authorizationRevision: input.identity.authorizationRevision,
      deviceCredential: input.identity.deviceCredential,
      deviceCredentialCommitment: input.identity.deviceCredentialCommitment,
      id: IdentityId.normalize(input.identity.id),
      networks: uniqueNetworks([
        ...input.identity.networks,
        ...(input.profile.networks ?? []),
      ]),
      previousIdentityExternalIdentifier:
        input.previousIdentityExternalIdentifier,
      profile: profileFrom(input.profile),
      recoveryAuthority: input.identity.recoveryAuthority,
      timestamp: input.timestamp,
      version: input.identity.version + 1,
    };
  }
}
