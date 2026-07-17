import { KeyPair, SymmetricKey } from '@haskou/value-objects';

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
import type { PigeonIdentityKeyProtectionGateway } from '../crypto/PigeonIdentityKeyProtectionGateway';
import type { CreatedIdentityMaterial } from './CreatedIdentityMaterial';
import type { IdentityUpdateProfileInput } from './IdentitySignaturePayloadFactory';
import type { IdentitySignaturePayloadFactory } from './IdentitySignaturePayloadFactory';
import type { PigeonIdentityGateway } from './PigeonIdentityGateway';

import { signSessionPayload } from '../../../../shared/infrastructure/crypto/signSessionPayload';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { clearLocalPasskeyUnlock } from '../storage/localPasskeyUnlock';

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
    private readonly keyProtection: PigeonIdentityKeyProtectionGateway,
  ) {}

  public async create(
    name: string,
    password: string,
    networks: string[],
    handle?: string,
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string } = {},
  ): Promise<CreatedIdentityMaterial> {
    const keyPair = await KeyPair.generate();
    const masterKey = SymmetricKey.generate();
    const identityId = IdentityId.normalize(keyPair.toPrimitives().publicKey);
    const { encryptedKeyPair, encryptedMasterKey, masterKeyDerivation } =
      await this.keyProtection.protectNewIdentity({
        displayName: name,
        identityId,
        keyPair,
        masterKey,
        options,
        password,
      });
    const unsigned = this.signatures.createInitial({
      encryptedKeyPair,
      encryptedMasterKey,
      id: identityId,
      masterKeyDerivation,
      networks,
      profile: { handle, name },
      timestamp: Date.now(),
    });
    const body = {
      ...unsigned,
      signature: keyPair.sign(JSON.stringify(unsigned)).toString(),
    };
    const signingSession = {
      identity: body,
      keychain: emptyKeychain,
      keyPair,
      masterKey,
    } as Session;
    const path = '/identities/';
    const identity = await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(signingSession, 'POST', path, body),
      method: 'POST',
    });

    return { identity, keyPair, masterKey };
  }

  public async createIdentity(
    identity: Identity,
    material: IdentityCreationMaterial,
    protection: IdentityMasterKeyProtection,
  ): Promise<CreatedIdentityMaterial> {
    const primitives = identity.toPrimitives();
    const options = protection.toPrimitives();
    const { encryptedKeyPair, encryptedMasterKey, masterKeyDerivation } =
      await this.keyProtection.protectNewIdentity({
        displayName: primitives.profile.name,
        identityId: primitives.id,
        keyPair: material.keyPair,
        masterKey: material.masterKey,
        options,
        password: options.password,
      });
    const unsigned = this.signatures.createInitial({
      encryptedKeyPair,
      encryptedMasterKey,
      id: primitives.id,
      masterKeyDerivation,
      networks: primitives.networkIds,
      profile: primitives.profile,
      timestamp: primitives.createdAt,
    });
    const body = {
      ...unsigned,
      signature: material.keyPair.sign(JSON.stringify(unsigned)).toString(),
    };
    const signingSession = {
      identity: body,
      keychain: emptyKeychain,
      keyPair: material.keyPair,
      masterKey: material.masterKey,
    } as Session;
    const path = '/identities/';
    const persistedIdentity = await this.http.request<IdentityResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(signingSession, 'POST', path, body),
      method: 'POST',
    });

    return {
      identity: persistedIdentity,
      keyPair: material.keyPair,
      masterKey: material.masterKey,
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

    const masterKeyEncryption =
      await this.keyProtection.protectProfileMasterKey({
        currentIdentity,
        identityId,
        newPassword,
        options,
        profile,
        session,
      });
    const path = `/identities/${encodeURIComponent(identityId)}`;
    const unsigned = this.signatures.createUpdate({
      encryptedMasterKey: masterKeyEncryption?.encryptedMasterKey,
      identity: currentIdentity,
      masterKeyDerivation: masterKeyEncryption?.masterKeyDerivation,
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

    if (options.passkeyPrfEnabled === false) {
      clearLocalPasskeyUnlock(identityId);
    }

    return updatedIdentity;
  }
}
