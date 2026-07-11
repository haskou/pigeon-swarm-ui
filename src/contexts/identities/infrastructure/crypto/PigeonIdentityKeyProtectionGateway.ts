import type { KeyPair, SymmetricKey } from '@haskou/value-objects';

import type {
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { IdentityUpdateProfileInput } from '../../domain/IdentitySignaturePayloadFactory';
import type { IdentityProfileKeyProtectionOptions } from './IdentityProfileKeyProtectionOptions';
import type { UserRootKeyPasskeyPrfInput } from './UserRootKeyPasskeyPrfInput';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import { saveLocalPasskeyUnlock } from '../storage/localPasskeyUnlock';
import { UserRootKeyProtector } from './UserRootKeyProtector';

export class PigeonIdentityKeyProtectionGateway {
  public constructor(
    private readonly keys: UserRootKeyProtector = new UserRootKeyProtector(),
  ) {}

  private profilePasskeyPrfMode({
    currentIdentity,
    enabled,
    identityId,
    profileName,
  }: {
    currentIdentity: IdentityResource;
    enabled?: boolean;
    identityId: string;
    profileName: string;
  }): UserRootKeyPasskeyPrfInput | undefined {
    if (enabled === false) return undefined;

    if (currentIdentity.masterKeyDerivation.passkeyPrf) {
      return {
        mode: 'preserve',
        protection: currentIdentity.masterKeyDerivation.passkeyPrf,
      };
    }

    if (!enabled) return undefined;

    return {
      displayName: profileName,
      identityId,
      mode: 'create',
    };
  }

  private profileRecoveryKey(
    currentIdentity: IdentityResource,
    recoveryKey?: string,
  ): RecoveryKey | undefined {
    if (!currentIdentity.masterKeyDerivation.recoveryKey || !recoveryKey) {
      return undefined;
    }

    return RecoveryKey.fromString(recoveryKey);
  }

  private async unlockRemoteMasterKey({
    identity,
    password,
    recoveryKey,
  }: {
    identity: IdentityResource;
    password: string;
    recoveryKey?: string;
  }): Promise<SymmetricKey> {
    let recoveryUnlockKey: RecoveryKey | undefined;

    try {
      recoveryUnlockKey = recoveryKey
        ? RecoveryKey.fromString(recoveryKey)
        : undefined;
    } catch {
      throw new Error(copy.auth.recoveryKeyUnlockFailed);
    }

    return await this.keys
      .unlockMasterKey(identity, password, recoveryUnlockKey)
      .catch(() => {
        throw new Error(
          recoveryKey
            ? copy.auth.recoveryKeyUnlockFailed
            : identity.masterKeyDerivation.passkeyPrf
              ? copy.auth.passkeyPrfUnlockFailed
              : copy.auth.invalidLogin,
        );
      });
  }

  public async protectNewIdentity({
    displayName,
    identityId,
    keyPair,
    masterKey,
    options,
    password,
  }: {
    displayName: string;
    identityId: string;
    keyPair: KeyPair;
    masterKey: SymmetricKey;
    options: { passkeyPrfEnabled?: boolean; recoveryKey?: string };
    password: string;
  }): Promise<{
    encryptedKeyPair: IdentityResource['encryptedKeyPair'];
    encryptedMasterKey: string;
    masterKeyDerivation: IdentityResource['masterKeyDerivation'];
  }> {
    const recoveryKey = options.recoveryKey
      ? RecoveryKey.fromString(options.recoveryKey)
      : undefined;
    const protectedMasterKey = await this.keys.protectMasterKey({
      masterKey,
      passkeyPrf: this.registrationPasskeyPrfMode({
        displayName,
        enabled: options.passkeyPrfEnabled,
        identityId,
      }),
      password,
      recoveryKey,
    });

    return {
      encryptedKeyPair: this.keys.protectIdentityKeyPair(keyPair, masterKey),
      ...protectedMasterKey,
    };
  }

  public registrationPasskeyPrfMode({
    displayName,
    enabled,
    identityId,
  }: {
    displayName: string;
    enabled?: boolean;
    identityId: string;
  }): UserRootKeyPasskeyPrfInput | undefined {
    if (!enabled) return undefined;

    return {
      displayName,
      identityId,
      mode: 'create',
    };
  }

  public async protectProfileMasterKey({
    currentIdentity,
    identityId,
    newPassword,
    options,
    profile,
    session,
  }: {
    currentIdentity: IdentityResource;
    identityId: string;
    newPassword?: string;
    options: IdentityProfileKeyProtectionOptions;
    profile: IdentityUpdateProfileInput;
    session: Session;
  }): Promise<
    | {
        encryptedMasterKey: string;
        masterKeyDerivation: IdentityResource['masterKeyDerivation'];
      }
    | undefined
  > {
    const masterKeyPassword = newPassword ?? options.currentPassword;

    if (!masterKeyPassword) return undefined;

    if (!newPassword && options.currentPassword) {
      await this.verifyRemoteMasterKeyFactors({
        identity: currentIdentity,
        password: options.currentPassword,
        recoveryKey: options.recoveryKey,
      });
    }

    const recoveryKey = this.profileRecoveryKey(
      currentIdentity,
      options.recoveryKey,
    );
    const protectedRoot = await this.keys.protectMasterKey({
      masterKey: session.masterKey,
      passkeyPrf: this.profilePasskeyPrfMode({
        currentIdentity,
        enabled: options.passkeyPrfEnabled,
        identityId,
        profileName: profile.name,
      }),
      password: masterKeyPassword,
      recoveryKey,
    });

    if (
      !recoveryKey &&
      currentIdentity.masterKeyDerivation.recoveryKey?.mode === 'recovery-key'
    ) {
      return {
        ...protectedRoot,
        masterKeyDerivation: {
          ...protectedRoot.masterKeyDerivation,
          recoveryKey: currentIdentity.masterKeyDerivation.recoveryKey,
        },
      };
    }

    return protectedRoot;
  }

  public async saveLocalPasskeyMasterKeyUnlock({
    displayName,
    identityId,
    masterKey,
    password,
  }: {
    displayName: string;
    identityId: string;
    masterKey: SymmetricKey;
    password: string;
  }): Promise<void> {
    const protectedRoot = await this.keys.protectMasterKey({
      masterKey,
      passkeyPrf: {
        displayName,
        identityId,
        mode: 'create',
      },
      password,
    });

    saveLocalPasskeyUnlock({
      encryptedMasterKey: protectedRoot.encryptedMasterKey,
      identityId,
      masterKeyDerivation: protectedRoot.masterKeyDerivation,
    });
  }

  public shouldConfirmPasskey(
    identity: IdentityResource,
    recoveryKey?: string,
  ): boolean {
    if (recoveryKey) return false;

    return !!identity.masterKeyDerivation.passkeyPrf;
  }

  public unlockIdentityKeyPair(
    identity: IdentityResource,
    masterKey: SymmetricKey,
  ): KeyPair {
    return this.keys.unlockIdentityKeyPair(identity, masterKey);
  }

  public async unlockLoginMasterKey({
    identity,
    password,
    recoveryKey,
  }: {
    identity: IdentityResource;
    password: string;
    recoveryKey?: string;
  }): Promise<SymmetricKey> {
    return await this.unlockRemoteMasterKey({
      identity,
      password,
      recoveryKey,
    });
  }

  public async verifyRemoteMasterKeyFactors({
    identity,
    password,
    recoveryKey,
  }: {
    identity: IdentityResource;
    password: string;
    recoveryKey?: string;
  }): Promise<void> {
    await this.unlockRemoteMasterKey({ identity, password, recoveryKey });
  }
}
