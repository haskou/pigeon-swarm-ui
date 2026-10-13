import type { IdentityId } from '../../domain/value-objects/IdentityId';
import type { DevicePasskeyAuthenticator } from './DevicePasskeyAuthenticator';
import type { DevicePasskeyCredential } from './DevicePasskeyCredential';
import type { DevicePasskeyEnrollment } from './DevicePasskeyEnrollment';

import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../../shared/infrastructure/encoding/base64url';
import { DevicePasskeyPrfUnavailableError } from './DevicePasskeyPrfUnavailableError';
import { DevicePasskeyRequestFailedError } from './DevicePasskeyRequestFailedError';

const challengeBytes = 32;
const saltBytes = 32;
const relyingPartyName = 'Pigeon Swarm';
const timeoutMs = 60_000;

function randomBuffer(length: number): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(length)).buffer;
}

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

function bytesOf(source: BufferSource): Uint8Array {
  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
}

function hasExtensionResults(
  credential: Credential | null,
): credential is Credential & {
  getClientExtensionResults: () => AuthenticationExtensionsClientOutputs;
} {
  return (
    credential !== null &&
    'getClientExtensionResults' in credential &&
    typeof credential.getClientExtensionResults === 'function'
  );
}

/** Reads the PRF outputs a browser attached to a WebAuthn response. */
function prfOutputs(
  credential: Credential | null,
): AuthenticationExtensionsPRFOutputs {
  if (!hasExtensionResults(credential)) {
    throw new DevicePasskeyPrfUnavailableError();
  }

  return credential.getClientExtensionResults().prf ?? {};
}

function rawCredentialId(credential: Credential | null): Uint8Array {
  if (
    !credential ||
    !('rawId' in credential) ||
    !(credential.rawId instanceof ArrayBuffer)
  ) {
    throw new DevicePasskeyPrfUnavailableError();
  }

  return new Uint8Array(credential.rawId);
}

/**
 * Some browsers never settle a WebAuthn request when no authenticator can
 * respond, so the request is aborted once its timeout elapses. Cancelled and
 * timed-out prompts surface as one typed error.
 */
async function requestCredential(
  request: (signal: AbortSignal) => Promise<Credential | null>,
): Promise<Credential | null> {
  const controller = new AbortController();
  const timedOut = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => {
      reject(new DevicePasskeyRequestFailedError());
    });
  });
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await Promise.race([request(controller.signal), timedOut]);
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'AbortError' || error.name === 'NotAllowedError')
    ) {
      throw new DevicePasskeyRequestFailedError();
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Derives the local unlock secret from the WebAuthn PRF extension of a
 * user-verified passkey. The authenticator enforces its own PIN or biometric
 * attempt limits, which page script cannot bypass.
 */
export class WebAuthnPasskeyPrf implements DevicePasskeyAuthenticator {
  /** A browser that cannot report capabilities may still support PRF. */
  private async capabilitiesAllowPrf(): Promise<boolean> {
    if (
      !('getClientCapabilities' in PublicKeyCredential) ||
      typeof PublicKeyCredential.getClientCapabilities !== 'function'
    ) {
      return true;
    }

    try {
      const capabilities: unknown =
        await PublicKeyCredential.getClientCapabilities();

      return !(
        capabilities &&
        typeof capabilities === 'object' &&
        'extension:prf' in capabilities &&
        capabilities['extension:prf'] === false
      );
    } catch {
      return true;
    }
  }

  public async evaluate(credential: DevicePasskeyCredential): Promise<string> {
    const salt = bufferOf(decodeBase64Url(credential.salt));
    const assertion = await requestCredential((signal) =>
      navigator.credentials.get({
        publicKey: {
          allowCredentials: [
            {
              id: bufferOf(decodeBase64Url(credential.credentialId)),
              type: 'public-key',
            },
          ],
          challenge: randomBuffer(challengeBytes),
          extensions: {
            prf: {
              evalByCredential: { [credential.credentialId]: { first: salt } },
            },
          },
          timeout: timeoutMs,
          userVerification: 'required',
        },
        signal,
      }),
    );
    const first = prfOutputs(assertion).results?.first;

    if (!first) throw new DevicePasskeyPrfUnavailableError();

    return encodeBase64Url(bytesOf(first));
  }

  public async isSupported(): Promise<boolean> {
    if (
      globalThis.isSecureContext !== true ||
      typeof PublicKeyCredential !== 'function' ||
      !navigator.credentials
    ) {
      return false;
    }

    return await this.capabilitiesAllowPrf();
  }

  public async register({
    displayName,
    identityId,
  }: {
    displayName: string;
    identityId: IdentityId;
  }): Promise<DevicePasskeyEnrollment> {
    const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
    const userId = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(identityId.valueOf()),
    );
    const created = await requestCredential((signal) =>
      navigator.credentials.create({
        publicKey: {
          attestation: 'none',
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'required',
          },
          challenge: randomBuffer(challengeBytes),
          extensions: { prf: { eval: { first: bufferOf(salt) } } },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          rp: { name: relyingPartyName },
          timeout: timeoutMs,
          user: {
            displayName,
            id: userId,
            name: displayName,
          },
        },
        signal,
      }),
    );
    const outputs = prfOutputs(created);
    const credential = {
      credentialId: encodeBase64Url(rawCredentialId(created)),
      salt: encodeBase64Url(salt),
    };
    const first = outputs.results?.first;

    if (first) {
      return { credential, secret: encodeBase64Url(bytesOf(first)) };
    }

    if (outputs.enabled !== true) throw new DevicePasskeyPrfUnavailableError();

    return { credential, secret: await this.evaluate(credential) };
  }
}
