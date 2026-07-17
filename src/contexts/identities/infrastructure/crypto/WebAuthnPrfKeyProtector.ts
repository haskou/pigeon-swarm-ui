import { SymmetricKey } from '@haskou/value-objects';

import type { PasskeyPrfMasterKeyProtection } from './PasskeyPrfMasterKeyProtection';
import type { PrfExtensionResults } from './PrfExtensionResults';
import type { PublicKeyCredentialWithExtensionResults } from './PublicKeyCredentialWithExtensionResults';

const passkeyPrfAlgorithm = 'webauthn-prf';
const passkeyPrfVersion = 1;
const challengeBytes = 32;
const saltBytes = 32;
const relyingPartyName = 'Pigeon Swarm';
const timeoutMs = 60_000;
const debugPrefix = '[WebAuthn PRF]';

async function userHandle(identityId: string): Promise<ArrayBuffer> {
  return await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identityId),
  );
}

function isPublicKeyCredentialWithPrf(
  credential: Credential | null,
): credential is PublicKeyCredentialWithExtensionResults {
  return (
    credential instanceof PublicKeyCredential &&
    typeof credential.getClientExtensionResults === 'function' &&
    credential.rawId instanceof ArrayBuffer
  );
}

function prfResults(credential: Credential | null): PrfExtensionResults {
  if (!isPublicKeyCredentialWithPrf(credential)) return {};

  return credential.getClientExtensionResults().prf ?? {};
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
  const first = prfResults(credential).results?.first;

  return first
    ? SymmetricKey.fromBase64(bytesToBase64(bufferSourceToBytes(first)))
    : undefined;
}

export class WebAuthnPrfKeyProtector {
  private static debug(event: string, details: Record<string, unknown>): void {
    // eslint-disable-next-line no-console -- Non-sensitive PRF diagnostics.
    console.debug(debugPrefix, event, details);
  }

  public static isAvailable(): boolean {
    return (
      typeof globalThis.isSecureContext === 'boolean' &&
      globalThis.isSecureContext &&
      typeof navigator !== 'undefined' &&
      !!navigator.credentials &&
      typeof PublicKeyCredential !== 'undefined'
    );
  }

  public static async isPrfAvailable(): Promise<boolean> {
    if (!WebAuthnPrfKeyProtector.isAvailable()) return false;

    const credential = PublicKeyCredential as typeof PublicKeyCredential & {
      getClientCapabilities?: () => Promise<
        Record<string, boolean | undefined>
      >;
    };

    WebAuthnPrfKeyProtector.debug('availability', {
      getClientCapabilitiesType: typeof credential.getClientCapabilities,
      isSecureContext: globalThis.isSecureContext,
      publicKeyCredentialType: typeof PublicKeyCredential,
    });

    if (typeof credential.getClientCapabilities === 'function') {
      try {
        const capabilities = await credential.getClientCapabilities();

        WebAuthnPrfKeyProtector.debug('capabilities', { capabilities });

        if (capabilities['extension:prf'] === false) return false;
      } catch (error) {
        WebAuthnPrfKeyProtector.debug('capabilities-error', {
          error: String(error),
        });
      }
    }

    return true;
  }

  private assertSupportedProtection(
    protection: PasskeyPrfMasterKeyProtection,
  ): void {
    if (
      protection.version !== passkeyPrfVersion ||
      protection.algorithm !== passkeyPrfAlgorithm
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
  }): Promise<PublicKeyCredentialWithExtensionResults> {
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

    const results = prfResults(credential);

    WebAuthnPrfKeyProtector.debug('create-result', {
      prfEnabled: results.enabled === true,
    });

    if (results.enabled !== true) {
      throw new Error(
        'This credential did not enable the WebAuthn PRF extension.',
      );
    }

    return credential;
  }

  private protection({
    credentialId,
    salt,
  }: {
    credentialId: string;
    salt: Uint8Array;
  }): PasskeyPrfMasterKeyProtection {
    return {
      algorithm: passkeyPrfAlgorithm,
      credentialId,
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

    WebAuthnPrfKeyProtector.debug('get-result', {
      hasFirstPrfResult: !!result,
    });

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
  }: {
    displayName: string;
    identityId: string;
  }): Promise<{
    prfKey: SymmetricKey;
    protection: PasskeyPrfMasterKeyProtection;
  }> {
    this.ensureAvailable();

    const salt = randomBytes(saltBytes);
    const credential = await this.createCredential({
      displayName,
      identityId,
      salt,
    });
    const credentialId = encodeBase64Url(new Uint8Array(credential.rawId));
    const prfKey =
      firstPrfResult(credential) ??
      (await this.evaluateCredential({
        credentialId,
        salt,
      }));

    return {
      prfKey,
      protection: this.protection({ credentialId, salt }),
    };
  }

  public async evaluateKey(
    protection: PasskeyPrfMasterKeyProtection,
  ): Promise<SymmetricKey> {
    this.assertSupportedProtection(protection);

    return await this.evaluateCredential({
      credentialId: protection.credentialId,
      salt: decodeBase64Url(protection.salt),
    });
  }
}
