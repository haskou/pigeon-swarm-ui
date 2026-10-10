import type { IdentityUpdateProfileInput } from './resources/IdentityUpdateProfileInput';

export type { IdentityUpdateProfileInput } from './resources/IdentityUpdateProfileInput';
import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { ProfileBiography } from '../../domain/profile/ProfileBiography';
import { ProfileHandle } from '../../domain/profile/ProfileHandle';
import { ProfileName } from '../../domain/profile/ProfileName';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { IdentityAdmissionProof } from '../crypto/IdentityAdmissionProof';

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
  /** Reuses the proof unless the networks changed; joining needs new work. */
  private async admissionNonceFor(
    id: string,
    networks: string[],
    current: IdentityResource,
  ): Promise<string> {
    const unchanged =
      networks.length === current.networks.length &&
      networks.every((network) => current.networks.includes(network));

    return unchanged
      ? current.admissionNonce
      : await IdentityAdmissionProof.mine(id, networks);
  }

  public async createInitial(input: {
    deviceCredential: string;
    deviceCredentialCommitment: string;
    id: string;
    networks: string[];
    profile: IdentityUpdateProfileInput;
    recoveryAuthority: string;
    timestamp: number;
  }): Promise<Omit<IdentityResource, 'signature'>> {
    const id = IdentityId.normalize(input.id);
    const networks = uniqueNetworks(input.networks);

    return {
      admissionNonce: await IdentityAdmissionProof.mine(id, networks),
      authorizationRevision: 0,
      deviceCredential: input.deviceCredential,
      deviceCredentialCommitment: input.deviceCredentialCommitment,
      id,
      networks,
      previousIdentityExternalIdentifier: undefined,
      profile: profileFrom(input.profile),
      recoveryAuthority: input.recoveryAuthority,
      timestamp: input.timestamp,
      version: 1,
    };
  }

  public async createUpdate(input: {
    identity: IdentityResource;
    previousIdentityExternalIdentifier?: string;
    profile: IdentityUpdateProfileInput;
    timestamp: number;
  }): Promise<Omit<IdentityResource, 'signature'>> {
    const id = IdentityId.normalize(input.identity.id);
    const networks = uniqueNetworks([
      ...input.identity.networks,
      ...(input.profile.networks ?? []),
    ]);

    return {
      admissionNonce: await this.admissionNonceFor(
        id,
        networks,
        input.identity,
      ),
      authorizationRevision: input.identity.authorizationRevision,
      deviceCredential: input.identity.deviceCredential,
      deviceCredentialCommitment: input.identity.deviceCredentialCommitment,
      id,
      networks,
      previousIdentityExternalIdentifier:
        input.previousIdentityExternalIdentifier,
      profile: profileFrom(input.profile),
      recoveryAuthority: input.identity.recoveryAuthority,
      timestamp: input.timestamp,
      version: input.identity.version + 1,
    };
  }
}
