import {
  KeyPair,
  SHA256Hash,
  SymmetricKey,
  UserRootKey,
} from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import type {
  IdentityResource,
  LocalKeychain,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Identity } from '../../domain/Identity';
import type { IdentityMasterKeyProtection } from '../../domain/value-objects/IdentityMasterKeyProtection';
import type { IdentityCreationMaterial } from '../crypto/IdentityCreationMaterial';
import type { DeviceIdentityVault } from '../storage/DeviceIdentityVault';
import type { CreatedIdentityMaterial } from './CreatedIdentityMaterial';
import type { IdentityUpdateProfileInput } from './IdentitySignaturePayloadFactory';
import type { IdentitySignaturePayloadFactory } from './IdentitySignaturePayloadFactory';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import { RecoveryIdentityMaterial } from '../crypto/RecoveryIdentityMaterial';

const emptyKeychain: LocalKeychain = {
  conversations: {},
  version: 0,
};

export class PigeonIdentityCommandsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly identities: PigeonIdentityGateway,
    private readonly signatures: IdentitySignaturePayloadFactory,
    private readonly vault: DeviceIdentityVault,
  ) {}

  private credentialCommitment(keyPair: KeyPair): string {
    return SHA256Hash.from(
      new StringValueObject(keyPair.toPrimitives().publicKey),
    ).valueOf();
  }

  public async changePassword(
    session: Session,
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    await this.vault.changePassword(
      IdentityId.fromString(session.identity.id),
      currentPassword,
      nextPassword,
    );
  }

  public async create(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<CreatedIdentityMaterial> {
    const recoveryKey = RecoveryKey.fromString(options.recoveryKey ?? '');
    const recovered = await RecoveryIdentityMaterial.derive(recoveryKey);
    const keyPair = recovered.identityKeyPair;
    const deviceCredentialKeyPair = await KeyPair.generate();
    const recoveryAuthorityKeyPair = recovered.recoveryAuthorityKeyPair;
    const rootKey = recovered.rootKey;
    const masterKey = SymmetricKey.fromBuffer(rootKey.getBuffer());
    const identityId = IdentityId.normalize(keyPair.toPrimitives().publicKey);
    const vaultSession = await this.vault.register({
      identityId: IdentityId.fromString(identityId),
      material: {
        deviceCredentialKeyPair,
        identityKeyPair: keyPair,
        recoveryAuthorityKeyPair,
        rootKey,
      },
      password,
    });
    const unsigned = await this.signatures.createInitial({
      deviceCredential: deviceCredentialKeyPair.toPrimitives().publicKey,
      deviceCredentialCommitment: this.credentialCommitment(
        deviceCredentialKeyPair,
      ),
      id: identityId,
      networks,
      profile: { handle, name },
      recoveryAuthority: recoveryAuthorityKeyPair.toPrimitives().publicKey,
      timestamp: Date.now(),
    });
    const body = {
      ...unsigned,
      signature: keyPair.sign(JSON.stringify(unsigned)).toString(),
    };
    const signingSession = {
      authorizationEpoch: vaultSession.authorizationEpoch,
      authorizationRevision: vaultSession.authorizationRevision,
      deviceCredentialKeyPair,
      deviceId: vaultSession.deviceId,
      identity: body,
      keychain: emptyKeychain,
      keyPair,
      masterKey,
      recoveryAuthorityKeyPair,
    } as Session;
    const path = '/identities/';
    let identity: IdentityResource;

    try {
      identity = await this.http.request<IdentityResource>(path, {
        body: JSON.stringify(body),
        headers: await this.signer.headers(signingSession, 'POST', path, body),
        method: 'POST',
      });
    } catch (error) {
      await this.vault.delete(IdentityId.fromString(identityId));
      throw error;
    }

    return {
      authorizationEpoch: vaultSession.authorizationEpoch,
      authorizationRevision: vaultSession.authorizationRevision,
      deviceCredentialKeyPair,
      deviceId: vaultSession.deviceId,
      identity,
      keyPair,
      masterKey,
      recoveryAuthorityKeyPair,
    };
  }

  public async createIdentity(
    identity: Identity,
    material: IdentityCreationMaterial,
    protection: IdentityMasterKeyProtection,
  ): Promise<CreatedIdentityMaterial> {
    const primitives = identity.toPrimitives();
    const options = protection.toPrimitives();
    const rootKey = UserRootKey.fromBase64(material.masterKey.valueOf());
    const recoveryAuthorityKeyPair = material.recoveryAuthorityKeyPair;
    const vaultSession = await this.vault.register({
      identityId: IdentityId.fromString(primitives.id),
      material: {
        deviceCredentialKeyPair: material.deviceCredentialKeyPair,
        identityKeyPair: material.keyPair,
        recoveryAuthorityKeyPair,
        rootKey,
      },
      password: options.password,
    });
    const unsigned = await this.signatures.createInitial({
      deviceCredential:
        material.deviceCredentialKeyPair.toPrimitives().publicKey,
      deviceCredentialCommitment: this.credentialCommitment(
        material.deviceCredentialKeyPair,
      ),
      id: primitives.id,
      networks: primitives.networkIds,
      profile: primitives.profile,
      recoveryAuthority: recoveryAuthorityKeyPair.toPrimitives().publicKey,
      timestamp: primitives.createdAt,
    });
    const body = {
      ...unsigned,
      signature: material.keyPair.sign(JSON.stringify(unsigned)).toString(),
    };
    const signingSession = {
      authorizationEpoch: vaultSession.authorizationEpoch,
      authorizationRevision: vaultSession.authorizationRevision,
      deviceCredentialKeyPair: material.deviceCredentialKeyPair,
      deviceId: vaultSession.deviceId,
      identity: body,
      keychain: emptyKeychain,
      keyPair: material.keyPair,
      masterKey: material.masterKey,
      recoveryAuthorityKeyPair,
    } as Session;
    const path = '/identities/';
    const persistedIdentity = await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(signingSession, 'POST', path, body),
      method: 'POST',
    });

    return {
      authorizationEpoch: vaultSession.authorizationEpoch,
      authorizationRevision: vaultSession.authorizationRevision,
      deviceCredentialKeyPair: material.deviceCredentialKeyPair,
      deviceId: vaultSession.deviceId,
      identity: persistedIdentity,
      keyPair: material.keyPair,
      masterKey: material.masterKey,
      recoveryAuthorityKeyPair,
    };
  }

  public async updateProfile(
    session: Session,
    profile: IdentityUpdateProfileInput,
    newPassword: string | undefined,
    options: {
      currentPassword?: string;
      passkeyPrfEnabled?: boolean;
      recoveryKey?: string;
    },
  ): Promise<IdentityResource> {
    const identityId = IdentityId.normalize(session.identity.id);
    const currentIdentity = await this.identities.get(identityId);
    const previousIdentityExternalIdentifier =
      currentIdentity.identityExternalIdentifier ??
      currentIdentity.previousIdentityExternalIdentifier ??
      session.identity.identityExternalIdentifier ??
      session.identity.previousIdentityExternalIdentifier;

    if (!previousIdentityExternalIdentifier) {
      throw new Error(copy.profile.missingIdentityExternalIdentifier);
    }

    if (newPassword) {
      await this.vault.changePassword(
        IdentityId.fromString(identityId),
        options.currentPassword ?? '',
        newPassword,
      );
    }
    const path = `/identities/${encodeURIComponent(identityId)}`;
    const unsigned = await this.signatures.createUpdate({
      identity: currentIdentity,
      previousIdentityExternalIdentifier,
      profile,
      timestamp: Date.now(),
    });
    const body = {
      ...unsigned,
      signature: (
        await signSessionPayload(session, JSON.stringify(unsigned))
      ).toString(),
    };
    const updatedIdentity = await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });

    this.identities.remember(updatedIdentity);

    return updatedIdentity;
  }
}
