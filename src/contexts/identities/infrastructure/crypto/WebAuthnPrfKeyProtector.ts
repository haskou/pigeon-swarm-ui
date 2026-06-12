import { EncryptedPayload, SymmetricKey } from '@haskou/value-objects';

import type { PasskeyPrfMasterKeyProtection } from '../../domain/PasskeyPrfMasterKeyProtection';

const keyAlgorithm = 'aes-256-gcm';
const passkeyPrfAlgorithm = 'webauthn-prf';
const passkeyPrfVersion = 1;
const challengeBytes = 32;
const saltBytes = 32;
const relyingPartyName = 'Pigeon Swarm';
const timeoutMs = 60_000;

async function userHandle(identityId: string): Promise<ArrayBuffer> {
  return await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identityId),
  );
}

function isPublicKeyCredentialWithPrf(
  credential: Credential | null,
): credential is PublicKeyCredential & {
  getClientExtensionResults(): {
    prf?: {
      enabled?: boolean;
      results?: {
        first?: BufferSource;
        second?: BufferSource;
      };
    };
  };
} {
  return (
    credential instanceof PublicKeyCredential &&
    typeof credential.getClientExtensionResults === 'function' &&
    credential.rawId instanceof ArrayBuffer
  );
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return bytes;
}

function bufferSourceToBytes(source: BufferSource): Uint8Array {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);

  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
}

function encodeBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function firstPrfResult(
  credential: Credential | null,
): SymmetricKey | undefined {
  if (!isPublicKeyCredentialWithPrf(credential)) return undefined;

  const first = credential.getClientExtensionResults().prf?.results?.first;

  return first
    ? SymmetricKey.fromBase64(bytesToBase64(bufferSourceToBytes(first)))
    : undefined;
}

export class WebAuthnPrfKeyProtector {
  public static isAvailable(): boolean {
    return (
      typeof globalThis.isSecureContext === 'boolean' &&
      globalThis.isSecureContext &&
      typeof navigator !== 'undefined' &&
      !!navigator.credentials &&
      typeof PublicKeyCredential !== 'undefined'
    );
  }

  private assertSupportedProtection(
    protection: PasskeyPrfMasterKeyProtection,
  ): void {
    if (
      protection.version !== passkeyPrfVersion ||
      protection.algorithm !== passkeyPrfAlgorithm ||
      protection.keyAlgorithm !== keyAlgorithm
    ) {
      throw new Error('Unsupported passkey PRF protection.');
    }
  }

  private async createCredential({
    displayName,
    identityId,
    salt,
  }: {
    displayName: string;
    identityId: string;
    salt: Uint8Array;
  }): Promise<
    PublicKeyCredential & {
      getClientExtensionResults(): {
        prf?: {
          enabled?: boolean;
          results?: {
            first?: BufferSource;
            second?: BufferSource;
          };
        };
      };
    }
  > {
    const credential = await navigator.credentials.create({
      publicKey: {
        attestation: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'required',
        },
        challenge: toArrayBuffer(randomBytes(challengeBytes)),
        extensions: {
          prf: {
            eval: {
              first: toArrayBuffer(salt),
            },
          },
        } as AuthenticationExtensionsClientInputs,
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        rp: {
          name: relyingPartyName,
        },
        timeout: timeoutMs,
        user: {
          displayName,
          id: await userHandle(identityId),
          name: identityId,
        },
      },
    });

    if (!isPublicKeyCredentialWithPrf(credential)) {
      throw new Error('Passkey PRF credential could not be created.');
    }

    return credential;
  }

  private encryptPasswordKey({
    credentialId,
    passwordKey,
    prfResult,
    salt,
  }: {
    credentialId: string;
    passwordKey: SymmetricKey;
    prfResult: SymmetricKey;
    salt: Uint8Array;
  }): PasskeyPrfMasterKeyProtection {
    return {
      algorithm: passkeyPrfAlgorithm,
      credentialId,
      encryptedPasswordKey: prfResult.encrypt(passwordKey.valueOf()).toString(),
      keyAlgorithm,
      salt: encodeBase64Url(salt),
      version: passkeyPrfVersion,
    };
  }

  private async evaluateCredential({
    credentialId,
    salt,
  }: {
    credentialId: string;
    salt: Uint8Array;
  }): Promise<SymmetricKey> {
    this.ensureAvailable();

    const credentialIdBytes = decodeBase64Url(credentialId);
    const credential = await navigator.credentials.get({
      publicKey: {
        allowCredentials: [
          {
            id: toArrayBuffer(credentialIdBytes),
            type: 'public-key',
          },
        ],
        challenge: toArrayBuffer(randomBytes(challengeBytes)),
        extensions: {
          prf: {
            evalByCredential: {
              [credentialId]: {
                first: toArrayBuffer(salt),
              },
            },
          },
        } as AuthenticationExtensionsClientInputs,
        timeout: timeoutMs,
        userVerification: 'required',
      },
    });

    const result = firstPrfResult(credential);

    if (!result) {
      throw new Error('This passkey does not expose WebAuthn PRF.');
    }

    return result;
  }

  private ensureAvailable(): void {
    if (!WebAuthnPrfKeyProtector.isAvailable()) {
      throw new Error('Passkey PRF is not available in this browser context.');
    }
  }

  public async createProtection({
    displayName,
    identityId,
    passwordKey,
  }: {
    displayName: string;
    identityId: string;
    passwordKey: SymmetricKey;
  }): Promise<PasskeyPrfMasterKeyProtection> {
    this.ensureAvailable();

    const salt = randomBytes(saltBytes);
    const credential = await this.createCredential({
      displayName,
      identityId,
      salt,
    });
    const credentialId = encodeBase64Url(new Uint8Array(credential.rawId));
    const result =
      firstPrfResult(credential) ??
      (await this.evaluateCredential({
        credentialId,
        salt,
      }));

    return this.encryptPasswordKey({
      credentialId,
      passwordKey,
      prfResult: result,
      salt,
    });
  }

  public async rewrapPasswordKey(
    protection: PasskeyPrfMasterKeyProtection,
    passwordKey: SymmetricKey,
  ): Promise<PasskeyPrfMasterKeyProtection> {
    this.assertSupportedProtection(protection);

    const salt = decodeBase64Url(protection.salt);
    const prfResult = await this.evaluateCredential({
      credentialId: protection.credentialId,
      salt,
    });

    return this.encryptPasswordKey({
      credentialId: protection.credentialId,
      passwordKey,
      prfResult,
      salt,
    });
  }

  public async unwrapPasswordKey(
    protection: PasskeyPrfMasterKeyProtection,
  ): Promise<SymmetricKey> {
    this.assertSupportedProtection(protection);

    const prfResult = await this.evaluateCredential({
      credentialId: protection.credentialId,
      salt: decodeBase64Url(protection.salt),
    });
    const decrypted = prfResult
      .decrypt(new EncryptedPayload(protection.encryptedPasswordKey))
      .toString();

    return SymmetricKey.fromBase64(decrypted);
  }
}
