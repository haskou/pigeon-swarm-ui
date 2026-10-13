import { mock } from 'jest-mock-extended';

import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DevicePasskeyPrfUnavailableError } from '../../../../../contexts/identities/infrastructure/crypto/DevicePasskeyPrfUnavailableError';
import { DevicePasskeyRequestFailedError } from '../../../../../contexts/identities/infrastructure/crypto/DevicePasskeyRequestFailedError';
import { WebAuthnPasskeyPrf } from '../../../../../contexts/identities/infrastructure/crypto/WebAuthnPasskeyPrf';
import { encodeBase64Url } from '../../../../../shared/infrastructure/encoding/base64url';

type BrowserGlobals = {
  capabilities?: Record<string, boolean>;
  credentials?: CredentialsContainer;
  publicKeyCredential?: boolean;
  secureContext?: boolean;
};

const globalNames = ['isSecureContext', 'PublicKeyCredential'] as const;
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);

function installBrowser({
  capabilities,
  credentials = mock<CredentialsContainer>(),
  publicKeyCredential = true,
  secureContext = true,
}: BrowserGlobals): CredentialsContainer {
  Object.defineProperty(globalThis, 'isSecureContext', {
    configurable: true,
    value: secureContext,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { credentials },
  });
  Object.defineProperty(globalThis, 'PublicKeyCredential', {
    configurable: true,
    value: publicKeyCredential
      ? Object.assign(function PublicKeyCredential() {}, {
          getClientCapabilities: capabilities
            ? () => Promise.resolve(capabilities)
            : undefined,
        })
      : undefined,
  });

  return credentials;
}

function publicKeyCredential(
  rawId: Uint8Array,
  prf: { enabled?: boolean; results?: { first?: Uint8Array } },
): Credential {
  return {
    getClientExtensionResults: () => ({ prf }),
    id: encodeBase64Url(rawId),
    rawId: rawId.buffer,
    type: 'public-key',
  } as unknown as Credential;
}

function bytes(length: number, value: number): Uint8Array {
  return new Uint8Array(length).fill(value);
}

function sentBytes(source: BufferSource | undefined): Uint8Array {
  if (!source) throw new Error('The PRF input was not sent.');

  return ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
}

describe(WebAuthnPasskeyPrf.name, () => {
  const identityId = IdentityId.fromString('identity-id');

  afterEach(() => {
    for (const name of globalNames) {
      Reflect.deleteProperty(globalThis, name);
    }

    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
  });

  describe('isSupported', () => {
    it('is unsupported in a browser without WebAuthn', async () => {
      installBrowser({ publicKeyCredential: false });

      await expect(new WebAuthnPasskeyPrf().isSupported()).resolves.toBe(false);
    });

    it('is unsupported outside a secure context', async () => {
      installBrowser({ secureContext: false });

      await expect(new WebAuthnPasskeyPrf().isSupported()).resolves.toBe(false);
    });

    it('is unsupported when the browser reports no PRF extension', async () => {
      installBrowser({ capabilities: { 'extension:prf': false } });

      await expect(new WebAuthnPasskeyPrf().isSupported()).resolves.toBe(false);
    });

    it('is supported when the browser reports the PRF extension', async () => {
      installBrowser({ capabilities: { 'extension:prf': true } });

      await expect(new WebAuthnPasskeyPrf().isSupported()).resolves.toBe(true);
    });

    it('is supported when the browser cannot report capabilities', async () => {
      installBrowser({});

      await expect(new WebAuthnPasskeyPrf().isSupported()).resolves.toBe(true);
    });
  });

  describe('register', () => {
    it('requires user verification and returns the PRF output of a new passkey', async () => {
      const credentials = installBrowser({});
      jest.mocked(credentials.create).mockResolvedValue(
        publicKeyCredential(bytes(16, 7), {
          enabled: true,
          results: { first: bytes(32, 9) },
        }),
      );

      const enrollment = await new WebAuthnPasskeyPrf().register({
        displayName: 'Alice',
        identityId,
      });

      const options = jest.mocked(credentials.create).mock.calls[0][0];
      const salt = sentBytes(options?.publicKey?.extensions?.prf?.eval?.first);
      expect(options?.publicKey?.authenticatorSelection).toMatchObject({
        userVerification: 'required',
      });
      expect(options?.publicKey?.user.displayName).toBe('Alice');
      expect(salt.byteLength).toBe(32);
      expect(enrollment).toEqual({
        credential: {
          credentialId: encodeBase64Url(bytes(16, 7)),
          salt: encodeBase64Url(salt),
        },
        secret: encodeBase64Url(bytes(32, 9)),
      });
    });

    it('evaluates the PRF with a second prompt when creation only enables it', async () => {
      const credentials = installBrowser({});
      jest
        .mocked(credentials.create)
        .mockResolvedValue(
          publicKeyCredential(bytes(16, 7), { enabled: true }),
        );
      jest.mocked(credentials.get).mockResolvedValue(
        publicKeyCredential(bytes(16, 7), {
          results: { first: bytes(32, 5) },
        }),
      );

      const enrollment = await new WebAuthnPasskeyPrf().register({
        displayName: 'Alice',
        identityId,
      });

      expect(enrollment.secret).toBe(encodeBase64Url(bytes(32, 5)));
    });

    it('rejects a passkey that cannot evaluate the PRF extension', async () => {
      const credentials = installBrowser({});
      jest
        .mocked(credentials.create)
        .mockResolvedValue(publicKeyCredential(bytes(16, 7), {}));

      await expect(
        new WebAuthnPasskeyPrf().register({ displayName: 'Alice', identityId }),
      ).rejects.toBeInstanceOf(DevicePasskeyPrfUnavailableError);
      expect(credentials.get).not.toHaveBeenCalled();
    });

    it('reports a cancelled prompt as a failed passkey request', async () => {
      const credentials = installBrowser({});
      jest
        .mocked(credentials.create)
        .mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'));

      await expect(
        new WebAuthnPasskeyPrf().register({ displayName: 'Alice', identityId }),
      ).rejects.toBeInstanceOf(DevicePasskeyRequestFailedError);
    });
  });

  describe('evaluate', () => {
    it('asks the enrolled passkey for the PRF output of the stored salt', async () => {
      const credentials = installBrowser({});
      const credentialId = encodeBase64Url(bytes(16, 7));
      const salt = encodeBase64Url(bytes(32, 3));
      jest.mocked(credentials.get).mockResolvedValue(
        publicKeyCredential(bytes(16, 7), {
          results: { first: bytes(32, 5) },
        }),
      );

      const secret = await new WebAuthnPasskeyPrf().evaluate({
        credentialId,
        salt,
      });

      const options = jest.mocked(credentials.get).mock.calls[0][0];
      const evaluation = sentBytes(
        options?.publicKey?.extensions?.prf?.evalByCredential?.[credentialId]
          ?.first,
      );
      expect(options?.publicKey?.userVerification).toBe('required');
      expect(options?.publicKey?.allowCredentials).toHaveLength(1);
      expect(encodeBase64Url(evaluation)).toBe(salt);
      expect(secret).toBe(encodeBase64Url(bytes(32, 5)));
    });

    it('rejects an assertion without a PRF output', async () => {
      const credentials = installBrowser({});
      jest
        .mocked(credentials.get)
        .mockResolvedValue(publicKeyCredential(bytes(16, 7), {}));

      await expect(
        new WebAuthnPasskeyPrf().evaluate({
          credentialId: encodeBase64Url(bytes(16, 7)),
          salt: encodeBase64Url(bytes(32, 3)),
        }),
      ).rejects.toBeInstanceOf(DevicePasskeyPrfUnavailableError);
    });

    it('reports an aborted prompt as a failed passkey request', async () => {
      const credentials = installBrowser({});
      jest
        .mocked(credentials.get)
        .mockRejectedValue(new DOMException('aborted', 'AbortError'));

      await expect(
        new WebAuthnPasskeyPrf().evaluate({
          credentialId: encodeBase64Url(bytes(16, 7)),
          salt: encodeBase64Url(bytes(32, 3)),
        }),
      ).rejects.toBeInstanceOf(DevicePasskeyRequestFailedError);
    });
  });
});
