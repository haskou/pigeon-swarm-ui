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
  getClientCapabilities,
}: {
  create: jest.Mock;
  get: jest.Mock;
  getClientCapabilities?: jest.Mock;
}): void {
  Object.defineProperty(FakePublicKeyCredential, 'getClientCapabilities', {
    configurable: true,
    value: getClientCapabilities,
  });

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

  it('reports PRF availability when the browser exposes the PRF extension capability', async () => {
    installWebAuthn({
      create: jest.fn(),
      get: jest.fn(),
      getClientCapabilities: jest
        .fn()
        .mockResolvedValue({ 'extension:prf': true }),
    });

    await expect(WebAuthnPrfKeyProtector.isPrfAvailable()).resolves.toBe(true);
  });

  it('does not report PRF availability when only generic WebAuthn exists', async () => {
    installWebAuthn({
      create: jest.fn(),
      get: jest.fn(),
    });

    await expect(WebAuthnPrfKeyProtector.isPrfAvailable()).resolves.toBe(false);
  });

  it('creates WebAuthn PRF protection and returns the PRF key material', async () => {
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

    const { prfKey, protection } = await protector.createProtection({
      displayName: 'Hasko',
      identityId: 'identity-1',
    });

    expect(protection).toMatchObject({
      algorithm: 'webauthn-prf',
      version: 1,
    });
    expect(protection.credentialId).toBe('AQIDBAUGBwgJCgsM');
    expect(prfKey.valueOf()).toBe(
      'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
    );
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
    expect(get).not.toHaveBeenCalled();
  });

  it('evaluates an existing WebAuthn PRF protection', async () => {
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
    const { protection } = await protector.createProtection({
      displayName: 'Hasko',
      identityId: 'identity-1',
    });

    const evaluated = await protector.evaluateKey(protection);

    expect(evaluated.valueOf()).toBe(
      'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
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
});
