import {
  EncryptedPayload,
  KeyPair,
  PrivateKey,
  PublicKey,
  StringValueObject,
  SymmetricKey,
} from '@haskou/value-objects';
import { Buffer } from 'buffer';

import type { IdentityResource } from '../../domain/IdentityResource';
import type { PasskeyPrfMasterKeyProtection } from '../../domain/PasskeyPrfMasterKeyProtection';
import type { UserRootKeyPasskeyPrfInput } from './UserRootKeyPasskeyPrfInput';

import { RecoveryKey } from '../../domain/value-objects/RecoveryKey';
import { WebAuthnPrfKeyProtector } from './WebAuthnPrfKeyProtector';

const passwordPasskeyInfo = '@pigeon/user-root-key/password+passkey-prf/v1';
const passwordRecoveryInfo = '@pigeon/user-root-key/password+recovery/v1';
const passkeyPrfInfo = '@pigeon/passkey-prf/v1';
const recoveryKeyInfo = '@pigeon/recovery-key/v1';
const hkdfSaltBytes = 32;

export const userRootKeyDerivationDefaults = {
  algorithm: 'scrypt',
  N: 2 ** 18,
  p: 1,
  r: 8,
  version: 1,
} as const satisfies Omit<
  IdentityResource['masterKeyDerivation'],
  'passkeyPrf' | 'recoveryKey' | 'salt'
>;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(left.byteLength + right.byteLength);

  bytes.set(left, 0);
  bytes.set(right, left.byteLength);

  return bytes;
}

async function hkdfKey(input: Uint8Array, info: string): Promise<SymmetricKey> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(input),
    'HKDF',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: 'SHA-256',
      info: new TextEncoder().encode(info),
      name: 'HKDF',
      salt: new Uint8Array(hkdfSaltBytes),
    },
    key,
    256,
  );

  return SymmetricKey.fromBuffer(Buffer.from(bits));
}

export class UserRootKeyProtector {
  private readonly passkeys: WebAuthnPrfKeyProtector;

  public constructor(
    passkeys?: WebAuthnPrfKeyProtector,
    private readonly derivationDefaults: Omit<
      IdentityResource['masterKeyDerivation'],
      'passkeyPrf' | 'recoveryKey' | 'salt'
    > = userRootKeyDerivationDefaults,
  ) {
    this.passkeys = passkeys ?? new WebAuthnPrfKeyProtector();
  }

  private async derivePasswordKek(
    password: string,
    derivation: IdentityResource['masterKeyDerivation'],
  ): Promise<SymmetricKey> {
    if (
      derivation.algorithm !== 'scrypt' ||
      derivation.version !== this.derivationDefaults.version
    ) {
      throw new Error('Unsupported user root key derivation.');
    }

    return await SymmetricKey.fromPassword(password, {
      N: derivation.N,
      p: derivation.p,
      r: derivation.r,
      salt: derivation.salt,
    });
  }

  private async passkeyMaterial(input: UserRootKeyPasskeyPrfInput): Promise<{
    prfKey: SymmetricKey;
    protection: PasskeyPrfMasterKeyProtection;
  }> {
    if (input.mode === 'create') {
      return await this.passkeys.createProtection({
        displayName: input.displayName,
        identityId: input.identityId,
      });
    }

    return {
      prfKey: await this.passkeys.evaluateKey(input.protection),
      protection: input.protection,
    };
  }

  private async passkeyKek(prfKey: SymmetricKey): Promise<SymmetricKey> {
    return await hkdfKey(prfKey.getBuffer(), passkeyPrfInfo);
  }

  private async recoveryKek(recoveryKey: RecoveryKey): Promise<SymmetricKey> {
    return await hkdfKey(recoveryKey.getBytes(), recoveryKeyInfo);
  }

  private async finalKek({
    passkeyPrf,
    passwordKek,
    recoveryKey,
  }: {
    passkeyPrf?: UserRootKeyPasskeyPrfInput;
    passwordKek: SymmetricKey;
    recoveryKey?: RecoveryKey;
  }): Promise<{
    kek: SymmetricKey;
    passkeyPrf?: PasskeyPrfMasterKeyProtection;
  }> {
    if (recoveryKey) {
      const recoveryKek = await this.recoveryKek(recoveryKey);
      const combined = concatBytes(
        passwordKek.getBuffer(),
        recoveryKek.getBuffer(),
      );

      return {
        kek: await hkdfKey(combined, passwordRecoveryInfo),
      };
    }

    if (!passkeyPrf) return { kek: passwordKek };

    const material = await this.passkeyMaterial(passkeyPrf);
    const passkeyKek = await this.passkeyKek(material.prfKey);
    const combined = concatBytes(
      passwordKek.getBuffer(),
      passkeyKek.getBuffer(),
    );

    return {
      kek: await hkdfKey(combined, passwordPasskeyInfo),
      passkeyPrf: material.protection,
    };
  }

  public async protectMasterKey({
    masterKey,
    passkeyPrf,
    password,
    recoveryKey,
  }: {
    masterKey: SymmetricKey;
    passkeyPrf?: UserRootKeyPasskeyPrfInput;
    password: string;
    recoveryKey?: RecoveryKey;
  }): Promise<{
    encryptedMasterKey: string;
    masterKeyDerivation: IdentityResource['masterKeyDerivation'];
  }> {
    const masterKeyDerivation: IdentityResource['masterKeyDerivation'] = {
      ...this.derivationDefaults,
      salt: SymmetricKey.generate().valueOf(),
    };
    const passwordKek = await this.derivePasswordKek(
      password,
      masterKeyDerivation,
    );
    const { kek, passkeyPrf: protection } = await this.finalKek({
      passkeyPrf,
      passwordKek,
      recoveryKey,
    });

    return {
      encryptedMasterKey: kek.encrypt(masterKey.valueOf()).toString(),
      masterKeyDerivation: {
        ...masterKeyDerivation,
        ...(protection ? { passkeyPrf: protection } : {}),
        ...(recoveryKey
          ? {
              recoveryKey: {
                algorithm: 'pigeon-recovery-key',
                version: 1,
              } as const,
            }
          : {}),
      },
    };
  }

  public async unlockMasterKey(
    identity: IdentityResource,
    password: string,
    recoveryKey?: RecoveryKey,
  ): Promise<SymmetricKey> {
    if (identity.masterKeyDerivation.recoveryKey && !recoveryKey) {
      throw new Error('Recovery key is required to unlock this identity.');
    }

    const passwordKek = await this.derivePasswordKek(
      password,
      identity.masterKeyDerivation,
    );
    const { kek } = await this.finalKek({
      passkeyPrf: identity.masterKeyDerivation.passkeyPrf
        ? {
            mode: 'preserve',
            protection: identity.masterKeyDerivation.passkeyPrf,
          }
        : undefined,
      passwordKek,
      recoveryKey,
    });
    const decrypted = kek.decrypt(
      new EncryptedPayload(identity.encryptedMasterKey),
    );

    return SymmetricKey.fromBase64(decrypted.toString());
  }

  public protectIdentityKeyPair(
    keyPair: KeyPair,
    masterKey: SymmetricKey,
  ): IdentityResource['encryptedKeyPair'] {
    const primitives = keyPair.toPrimitives();

    return {
      encryptedPrivateKey: masterKey.encrypt(primitives.privateKey).toString(),
      publicKey: primitives.publicKey,
    };
  }

  public unlockIdentityKeyPair(
    identity: IdentityResource,
    masterKey: SymmetricKey,
  ): KeyPair {
    const publicKey = PublicKey.fromPEM(
      new StringValueObject(identity.encryptedKeyPair.publicKey),
    );
    const privateKeyPem = masterKey
      .decrypt(
        new EncryptedPayload(identity.encryptedKeyPair.encryptedPrivateKey),
      )
      .toString();
    const privateKey = PrivateKey.fromPEM(new StringValueObject(privateKeyPem));

    return new KeyPair(publicKey, privateKey);
  }
}
