import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type { DeviceIdentityKeyMaterial } from '../crypto/DeviceIdentityKeyMaterial';
import type { DevicePasskeyAuthenticator } from '../crypto/DevicePasskeyAuthenticator';
import type { DevicePasskeyCredential } from '../crypto/DevicePasskeyCredential';
import type { ProtectedDeviceIdentity } from '../crypto/ProtectedDeviceIdentity';
import type { DeviceIdentityVaultRecord } from './DeviceIdentityVaultRecord';
import type { DeviceIdentityVaultSession } from './DeviceIdentityVaultSession';
import type { DeviceIdentityVaultStore } from './DeviceIdentityVaultStore';
import type { DeviceUnlockMethod } from './DeviceUnlockMethod';

import { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceId } from '../../domain/value-objects/DeviceId';
import { DeviceRootKeyEnvelope } from '../../domain/value-objects/DeviceRootKeyEnvelope';
import { DeviceUnlockSecretHandle } from '../../domain/value-objects/DeviceUnlockSecretHandle';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { DeviceIdentityProtector } from '../crypto/DeviceIdentityProtector';
import { WebAuthnPasskeyPrf } from '../crypto/WebAuthnPasskeyPrf';
import { DevicePasskeyUnlockDisabledError } from './DevicePasskeyUnlockDisabledError';
import { DevicePasskeyUnlockEnabledError } from './DevicePasskeyUnlockEnabledError';
import { IndexedDbDeviceIdentityVaultStore } from './IndexedDbDeviceIdentityVaultStore';
import { LocalDeviceIdentityNotFoundError } from './LocalDeviceIdentityNotFoundError';

export class DeviceIdentityVault {
  private readonly passkeys: DevicePasskeyAuthenticator;
  private readonly protector: DeviceIdentityProtector;
  private readonly store: DeviceIdentityVaultStore;

  public constructor(
    store?: DeviceIdentityVaultStore,
    protector?: DeviceIdentityProtector,
    passkeys?: DevicePasskeyAuthenticator,
  ) {
    this.store = store ?? new IndexedDbDeviceIdentityVaultStore();
    this.protector = protector ?? new DeviceIdentityProtector();
    this.passkeys = passkeys ?? new WebAuthnPasskeyPrf();
  }

  private protectedIdentity(
    record: DeviceIdentityVaultRecord,
  ): ProtectedDeviceIdentity {
    return {
      deviceId: DeviceId.fromString(record.deviceId),
      encryptedMaterial: new EncryptedPayload(record.encryptedMaterial),
      envelope: DeviceRootKeyEnvelope.fromString(record.envelope),
      factorKey: record.factorKey,
      identityId: IdentityId.fromString(record.identityId),
      secretHandle: DeviceUnlockSecretHandle.fromString(record.secretHandle),
    };
  }

  private record(
    identity: ProtectedDeviceIdentity,
    epoch: DeviceAuthorizationEpoch,
    revision: DeviceAuthorizationRevision,
    createdAt: number,
    passkey?: DevicePasskeyCredential,
  ): DeviceIdentityVaultRecord {
    return {
      authorizationEpoch: epoch.valueOf(),
      authorizationRevision: revision.valueOf(),
      createdAt,
      deviceId: identity.deviceId.valueOf(),
      encryptedMaterial: identity.encryptedMaterial.valueOf(),
      envelope: identity.envelope.serialize(),
      factorKey: identity.factorKey,
      identityId: identity.identityId.valueOf(),
      ...(passkey ? { passkey } : {}),
      secretHandle: identity.secretHandle.valueOf(),
      updatedAt: Date.now(),
      version: 2,
    };
  }

  /**
   * Rewraps the root key from one unlock secret to the next and stores only
   * the new envelope, so the previous secret no longer unlocks this device.
   */
  private async replaceEnvelope(
    current: DeviceIdentityVaultRecord,
    currentSecret: string,
    nextSecret: string,
    passkey?: DevicePasskeyCredential,
  ): Promise<void> {
    const rewrapped = await this.protector.rewrap(
      this.protectedIdentity(current),
      currentSecret,
      nextSecret,
    );

    await this.store.replaceProtection(
      current,
      this.record(
        rewrapped,
        DeviceAuthorizationEpoch.fromString(current.authorizationEpoch),
        DeviceAuthorizationRevision.fromNumber(current.authorizationRevision),
        current.createdAt,
        passkey,
      ),
    );
  }

  private async requiredRecord(
    identityId: IdentityId,
  ): Promise<DeviceIdentityVaultRecord> {
    const record = await this.store.find(identityId);

    assert(record?.version === 2, new LocalDeviceIdentityNotFoundError());

    return record;
  }

  public async advanceAuthorization(
    identityId: IdentityId,
    previousRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
  ): Promise<void> {
    await this.store.advanceAuthorization(identityId, previousRevision, epoch);
  }

  public async synchronizeAuthorization(
    identityId: IdentityId,
    localRevision: DeviceAuthorizationRevision,
    epoch: DeviceAuthorizationEpoch,
    revision: DeviceAuthorizationRevision,
  ): Promise<void> {
    await this.store.synchronizeAuthorization(
      identityId,
      localRevision,
      epoch,
      revision,
    );
  }

  public async changePassword(
    identityId: IdentityId,
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    const current = await this.requiredRecord(identityId);

    assert(!current.passkey, new DevicePasskeyUnlockEnabledError());
    await this.replaceEnvelope(current, currentPassword, nextPassword);
  }

  /** Turns passkey unlock off; the passkey must still confirm the change. */
  public async disablePasskey(
    identityId: IdentityId,
    nextPassword: string,
  ): Promise<void> {
    const current = await this.requiredRecord(identityId);

    assert(current.passkey, new DevicePasskeyUnlockDisabledError());
    await this.replaceEnvelope(
      current,
      await this.passkeys.evaluate(current.passkey),
      nextPassword,
    );
  }

  /**
   * Replaces the password with a passkey. The password is checked before the
   * passkey is created so a typo does not leave an unused passkey behind.
   */
  public async enablePasskey(
    identityId: IdentityId,
    currentPassword: string,
    displayName: string,
  ): Promise<void> {
    const current = await this.requiredRecord(identityId);

    assert(!current.passkey, new DevicePasskeyUnlockEnabledError());
    await this.protector.unlock(
      this.protectedIdentity(current),
      currentPassword,
    );
    const enrollment = await this.passkeys.register({
      displayName,
      identityId,
    });

    await this.replaceEnvelope(
      current,
      currentPassword,
      enrollment.secret,
      enrollment.credential,
    );
  }

  public async isPasskeySupported(): Promise<boolean> {
    return await this.passkeys.isSupported();
  }

  /** Asks the enrolled passkey for the secret that unlocks this device. */
  public async passkeyUnlockSecret(identityId: IdentityId): Promise<string> {
    const record = await this.requiredRecord(identityId);

    assert(record.passkey, new DevicePasskeyUnlockDisabledError());

    return await this.passkeys.evaluate(record.passkey);
  }

  public async unlockMethod(
    identityId: IdentityId,
  ): Promise<DeviceUnlockMethod | undefined> {
    const record = await this.store.find(identityId);

    if (record?.version !== 2) return undefined;

    return record.passkey ? 'passkey' : 'password';
  }

  public async delete(identityId: IdentityId): Promise<void> {
    await this.store.delete(identityId);
  }

  public async register(input: {
    authorizationEpoch?: DeviceAuthorizationEpoch;
    authorizationRevision?: DeviceAuthorizationRevision;
    identityId: IdentityId;
    material: DeviceIdentityKeyMaterial;
    password: string;
  }): Promise<DeviceIdentityVaultSession> {
    const deviceId = DeviceId.generate();
    const secretHandle = DeviceUnlockSecretHandle.generate();
    const protectedIdentity = await this.protector.protect({
      deviceId,
      identityId: input.identityId,
      material: input.material,
      password: input.password,
      secretHandle,
    });
    const authorizationEpoch =
      input.authorizationEpoch ?? DeviceAuthorizationEpoch.genesis();
    const authorizationRevision =
      input.authorizationRevision ?? DeviceAuthorizationRevision.initial();
    const createdAt = Date.now();

    await this.store.save(
      this.record(
        protectedIdentity,
        authorizationEpoch,
        authorizationRevision,
        createdAt,
      ),
    );

    return {
      authorizationEpoch,
      authorizationRevision,
      deviceId,
      material: input.material,
      secretHandle,
    };
  }

  public async unlock(
    identityId: IdentityId,
    password: string,
  ): Promise<DeviceIdentityVaultSession> {
    const record = await this.requiredRecord(identityId);
    const material = await this.protector.unlock(
      this.protectedIdentity(record),
      password,
    );

    assert(
      IdentityId.fromString(
        material.identityKeyPair.toPrimitives().publicKey,
      ).isEqual(identityId),
      new Error('Local device identity does not match the requested identity.'),
    );

    return {
      authorizationEpoch: DeviceAuthorizationEpoch.fromString(
        record.authorizationEpoch,
      ),
      authorizationRevision: DeviceAuthorizationRevision.fromNumber(
        record.authorizationRevision,
      ),
      deviceId: DeviceId.fromString(record.deviceId),
      material,
      secretHandle: DeviceUnlockSecretHandle.fromString(record.secretHandle),
    };
  }
}
