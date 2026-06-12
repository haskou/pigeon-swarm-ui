import { SymmetricKey } from '@haskou/value-objects';

import { WebAuthnPrfKeyProtector } from './WebAuthnPrfKeyProtector';

class FakePublicKeyCredential {
  public constructor(
    public readonly rawId: ArrayBuffer,
    private readonly firstPrfResult: ArrayBuffer,
  ) {}

  public getClientExtensionResults(): {
    prf: { results: { first: ArrayBuffer } };
  } {
    return {
      prf: {
        results: {
          first: this.firstPrfResult,
        },
      },
    };
  }
}

function installWebAuthn({
  create,
  get,
}: {
  create: jest.Mock;
  get: jest.Mock;
}): void {
  Object.defineProperty(globalThis, 'isSecureContext', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      credentials: {
        create,
        get,
      },
    },
  });
  Object.defineProperty(globalThis, 'PublicKeyCredential', {
    configurable: true,
    value: FakePublicKeyCredential,
  });
}

describe(WebAuthnPrfKeyProtector.name, () => {
  const originalNavigator = globalThis.navigator;
  const originalPublicKeyCredential = globalThis.PublicKeyCredential;
  const originalSecureContext = globalThis.isSecureContext;

  const credentialRawId = new Uint8Array([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]).buffer;
  const firstPrfResult = new Uint8Array(32).fill(7).buffer;

  afterEach(() => {
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: originalSecureContext,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      configurable: true,
      value: originalPublicKeyCredential,
    });
    jest.restoreAllMocks();
  });

  it('wraps and unwraps a password-derived key using WebAuthn PRF', async () => {
    const create = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, firstPrfResult),
      );
    const get = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, firstPrfResult),
      );
    installWebAuthn({ create, get });
    const passwordKey = SymmetricKey.generate();
    const protector = new WebAuthnPrfKeyProtector();

    const protection = await protector.createProtection({
      displayName: 'Hasko',
      identityId: 'identity-1',
      passwordKey,
    });
    const unwrapped = await protector.unwrapPasswordKey(protection);

    expect(protection).toMatchObject({
      algorithm: 'webauthn-prf',
      keyAlgorithm: 'aes-256-gcm',
      version: 1,
    });
    expect(protection.credentialId).toBe('AQIDBAUGBwgJCgsM');
    expect(unwrapped.valueOf()).toBe(passwordKey.valueOf());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: expect.objectContaining({
          extensions: expect.objectContaining({
            prf: expect.objectContaining({
              eval: expect.objectContaining({
                first: expect.any(ArrayBuffer),
              }),
            }),
          }),
        }),
      }),
    );
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: expect.objectContaining({
          allowCredentials: [
            expect.objectContaining({
              id: expect.any(ArrayBuffer),
              type: 'public-key',
            }),
          ],
          extensions: expect.objectContaining({
            prf: expect.objectContaining({
              evalByCredential: expect.objectContaining({
                [protection.credentialId]: expect.objectContaining({
                  first: expect.any(ArrayBuffer),
                }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('rewraps a password-derived key with an existing passkey credential', async () => {
    const create = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, firstPrfResult),
      );
    const get = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, firstPrfResult),
      );
    installWebAuthn({ create, get });
    const protector = new WebAuthnPrfKeyProtector();
    const initialProtection = await protector.createProtection({
      displayName: 'Hasko',
      identityId: 'identity-1',
      passwordKey: SymmetricKey.generate(),
    });
    const nextPasswordKey = SymmetricKey.generate();

    const nextProtection = await protector.rewrapPasswordKey(
      initialProtection,
      nextPasswordKey,
    );
    const unwrapped = await protector.unwrapPasswordKey(nextProtection);

    expect(nextProtection.credentialId).toBe(initialProtection.credentialId);
    expect(nextProtection.salt).toBe(initialProtection.salt);
    expect(nextProtection.encryptedPasswordKey).not.toBe(
      initialProtection.encryptedPasswordKey,
    );
    expect(unwrapped.valueOf()).toBe(nextPasswordKey.valueOf());
  });
});
