import type { IdentitySignaturePayload } from '@haskou/pigeon-swarm-crypto';

import { ProofOfWork } from '@haskou/pigeon-swarm-crypto';

import type { IdentityUpdateProfileInput } from './resources/IdentityUpdateProfileInput';

export type { IdentityUpdateProfileInput } from './resources/IdentityUpdateProfileInput';
import type { IdentityResource } from './resources/IdentityResource';

import { MailboxHomeBase } from '../../../../shared/infrastructure/client/MailboxHomeBase';
import { IdentityAdmissionDifficultyPolicy } from '../../domain/IdentityAdmissionDifficultyPolicy';
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
  public constructor(
    private readonly publishedMailboxHome?: () => string | undefined,
  ) {}

  /**
   * The fields of an identity record its identity key signs. Absent optional
   * fields are omitted: a node may serve them as null.
   */
  public static payloadOf(
    identity: Omit<IdentityResource, 'signature'>,
  ): IdentitySignaturePayload {
    const { banner, biography, handle, name, picture } = identity.profile;

    return {
      admissionNonce: identity.admissionNonce,
      authorizationRevision: identity.authorizationRevision,
      deviceCredential: identity.deviceCredential,
      deviceCredentialCommitment: identity.deviceCredentialCommitment,
      id: identity.id,
      mailboxHome: identity.mailboxHome ?? undefined,
      networks: identity.networks,
      previousIdentityExternalIdentifier:
        identity.previousIdentityExternalIdentifier ?? undefined,
      profile: {
        banner: banner ?? undefined,
        biography: biography ?? undefined,
        handle: handle ?? undefined,
        name,
        picture: picture ?? undefined,
      },
      recoveryAuthority: identity.recoveryAuthority,
      timestamp: identity.timestamp,
      version: identity.version,
    };
  }

  /**
   * Reuses the proof unless the networks changed or the node asked for a
   * stronger one; joining needs new work.
   */
  private async admissionNonceFor(
    id: string,
    networks: string[],
    current: IdentityResource,
    difficultyBits?: number,
  ): Promise<string> {
    const unchanged =
      networks.length === current.networks.length &&
      networks.every((network) => current.networks.includes(network));

    return unchanged && difficultyBits === undefined
      ? current.admissionNonce
      : await ProofOfWork.identityAdmission(id, networks).mint(
          difficultyBits ??
            IdentityAdmissionDifficultyPolicy.DEFAULT_DIFFICULTY_BITS,
        );
  }

  /** `admissionDifficultyBits` defaults to the protocol minimum. */
  public async createInitial(input: {
    admissionDifficultyBits?: number;
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
      admissionNonce: await ProofOfWork.identityAdmission(id, networks).mint(
        input.admissionDifficultyBits ??
          IdentityAdmissionDifficultyPolicy.DEFAULT_DIFFICULTY_BITS,
      ),
      authorizationRevision: 0,
      deviceCredential: input.deviceCredential,
      deviceCredentialCommitment: input.deviceCredentialCommitment,
      id,
      mailboxHome: MailboxHomeBase.parse(this.publishedMailboxHome?.()),
      networks,
      previousIdentityExternalIdentifier: undefined,
      profile: profileFrom(input.profile),
      recoveryAuthority: input.recoveryAuthority,
      timestamp: input.timestamp,
      version: 1,
    };
  }

  /** A set `admissionDifficultyBits` always re-mines the proof. */
  public async createUpdate(input: {
    admissionDifficultyBits?: number;
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
        input.admissionDifficultyBits,
      ),
      authorizationRevision: input.identity.authorizationRevision,
      deviceCredential: input.identity.deviceCredential,
      deviceCredentialCommitment: input.identity.deviceCredentialCommitment,
      id,
      mailboxHome: MailboxHomeBase.parse(input.identity.mailboxHome),
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
