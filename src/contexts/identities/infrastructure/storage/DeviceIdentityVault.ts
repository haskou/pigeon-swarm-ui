import { EncryptedPayload } from '@haskou/pigeon-swarm-crypto';
import { assert } from '@haskou/value-objects';

import type { DeviceIdentityKeyMaterial } from '../crypto/DeviceIdentityKeyMaterial';
import type { ProtectedDeviceIdentity } from '../crypto/ProtectedDeviceIdentity';
import type {
  DeviceIdentityVaultRecord,
  FirstKeychainPublishState,
} from './DeviceIdentityVaultRecord';
import type { DeviceIdentityVaultSession } from './DeviceIdentityVaultSession';
import type { DeviceIdentityVaultStore } from './DeviceIdentityVaultStore';

import { DeviceAuthorizationEpoch } from '../../domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../domain/value-objects/DeviceAuthorizationRevision';
import { DeviceId } from '../../domain/value-objects/DeviceId';
import { DeviceRootKeyEnvelope } from '../../domain/value-objects/DeviceRootKeyEnvelope';
import { DeviceUnlockSecretHandle } from '../../domain/value-objects/DeviceUnlockSecretHandle';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { IdentityPassword } from '../../domain/value-objects/IdentityPassword';
import { DeviceIdentityProtector } from '../crypto/DeviceIdentityProtector';
import { DeviceUnlockNotConfirmedError } from './DeviceUnlockNotConfirmedError';
import { IndexedDbDeviceIdentityVaultStore } from './IndexedDbDeviceIdentityVaultStore';
import { LocalDeviceIdentityNotFoundError } from './LocalDeviceIdentityNotFoundError';

export class DeviceIdentityVault {
  private readonly protector: DeviceIdentityProtector;
  private readonly store: DeviceIdentityVaultStore;

  /**
   * The password is the only unlock secret, so every envelope written for it
   * must meet the policy, whichever flow chose it.
   */
  private static assertStrong(password: string): void {
    IdentityPassword.fromString(password).assertStrong();
  }

  public constructor(
    store?: DeviceIdentityVaultStore,
    protector?: DeviceIdentityProtector,
  ) {
    this.store = store ?? new IndexedDbDeviceIdentityVaultStore();
    this.protector = protector ?? new DeviceIdentityProtector();
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
      secretHandle: identity.secretHandle.valueOf(),
      updatedAt: Date.now(),
      version: 2,
    };
  }

  /**
   * Rewraps the root key from the current password to the next and stores
   * only the new envelope, so the current password no longer unlocks this
   * device.
   */
  private async replaceEnvelope(
    current: DeviceIdentityVaultRecord,
    currentPassword: string,
    nextPassword: string,
  ): Promise<void> {
    const rewrapped = await this.protector.rewrap(
      this.protectedIdentity(current),
      currentPassword,
      nextPassword,
    );

    await this.store.replaceProtection(
      current,
      this.record(
        rewrapped,
        DeviceAuthorizationEpoch.fromString(current.authorizationEpoch),
        DeviceAuthorizationRevision.fromNumber(current.authorizationRevision),
        current.createdAt,
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
    DeviceIdentityVault.assertStrong(nextPassword);
    const current = await this.requiredRecord(identityId);

    await this.replaceEnvelope(current, currentPassword, nextPassword);
  }

  /**
   * Asks the person to type the password for this device again, without
   * changing anything.
   */
  public async confirmUnlock(
    identityId: IdentityId,
    password: string,
  ): Promise<void> {
    const record = await this.requiredRecord(identityId);

    try {
      assert(password, new DeviceUnlockNotConfirmedError());
      await this.protector.unlock(this.protectedIdentity(record), password);
    } catch {
      throw new DeviceUnlockNotConfirmedError();
    }
  }

  public async delete(identityId: IdentityId): Promise<void> {
    await this.store.delete(identityId);
  }

  /**
   * The first-publish state of an identity created on this device. Only an
   * `armed` state lets its first keychain post without a head. An identity
   * with no local record has none.
   */
  public async firstKeychainPublishState(
    identityId: IdentityId,
  ): Promise<FirstKeychainPublishState> {
    const record = await this.store.find(identityId);

    return record?.firstKeychainPublish ?? 'none';
  }

  /** Clears the marker: the first keychain is on the node, or never may be. */
  public async clearFirstKeychainPublish(
    identityId: IdentityId,
  ): Promise<void> {
    await this.store.clearFirstKeychainPublish(identityId);
  }

  /**
   * Moves the marker from `from` to `to` atomically and answers whether it
   * moved. A false answer means another tab changed it first.
   */
  public async transitionFirstKeychainPublish(
    identityId: IdentityId,
    from: FirstKeychainPublishState,
    to: FirstKeychainPublishState,
  ): Promise<boolean> {
    return await this.store.transitionFirstKeychainPublish(
      identityId,
      from,
      to,
    );
  }

  public async register(input: {
    authorizationEpoch?: DeviceAuthorizationEpoch;
    authorizationRevision?: DeviceAuthorizationRevision;
    firstKeychainPublish?: 'armed' | 'unacknowledged';
    identityId: IdentityId;
    material: DeviceIdentityKeyMaterial;
    password: string;
  }): Promise<DeviceIdentityVaultSession> {
    DeviceIdentityVault.assertStrong(input.password);
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

    const record: DeviceIdentityVaultRecord = {
      ...this.record(
        protectedIdentity,
        authorizationEpoch,
        authorizationRevision,
        createdAt,
      ),
      firstKeychainPublish: input.firstKeychainPublish,
    };

    // A first publish arms a new record, or replaces one still armed by an
    // earlier creation attempt that never sent its first keychain; a record
    // whose first publish started, or any other record, is refused rather
    // than re-armed. Other registrations overwrite the record and keep the
    // marker it already holds.
    if (input.firstKeychainPublish === 'armed') {
      await this.store.arm(record);
    } else {
      await this.store.save(record);
    }

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
