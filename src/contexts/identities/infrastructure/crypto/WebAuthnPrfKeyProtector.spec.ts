import { WebAuthnPrfKeyProtector } from './WebAuthnPrfKeyProtector';

class FakePublicKeyCredential {
  public constructor(
    public readonly rawId: ArrayBuffer,
    private readonly prf: {
      enabled?: boolean;
      results?: { first?: ArrayBuffer };
    },
  ) {}

  public getClientExtensionResults(): {
    prf: {
      enabled?: boolean;
      results?: { first?: ArrayBuffer };
    };
  } {
    return { prf: this.prf };
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
  const enabledPrfWithResult = {
    enabled: true,
    results: { first: firstPrfResult },
  };

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

  it('reports PRF as attemptable when the browser exposes the PRF extension capability', async () => {
    installWebAuthn({
      create: jest.fn(),
      get: jest.fn(),
      getClientCapabilities: jest
        .fn()
        .mockResolvedValue({ 'extension:prf': true }),
    });

    await expect(WebAuthnPrfKeyProtector.isPrfAvailable()).resolves.toBe(true);
  });

  it('does not block PRF attempts when client capabilities are missing', async () => {
    installWebAuthn({
      create: jest.fn(),
      get: jest.fn(),
    });

    await expect(WebAuthnPrfKeyProtector.isPrfAvailable()).resolves.toBe(true);
  });

  it('creates WebAuthn PRF protection without client capabilities when create returns PRF enabled', async () => {
    const create = jest.fn().mockResolvedValue(
      new FakePublicKeyCredential(credentialRawId, {
        enabled: true,
      }),
    );
    const get = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, enabledPrfWithResult),
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
    expect(get).toHaveBeenCalled();
  });

  it('evaluates an existing WebAuthn PRF protection', async () => {
    const create = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, enabledPrfWithResult),
      );
    const get = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, enabledPrfWithResult),
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

  it('evaluates PRF even when capabilities omit the PRF extension', async () => {
    const get = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, enabledPrfWithResult),
      );
    installWebAuthn({
      create: jest.fn(),
      get,
      getClientCapabilities: jest.fn().mockResolvedValue({}),
    });
    const protector = new WebAuthnPrfKeyProtector();

    const evaluated = await protector.evaluateKey({
      algorithm: 'webauthn-prf',
      credentialId: 'AQIDBAUGBwgJCgsM',
      salt: 'AQID',
      version: 1,
    });

    expect(evaluated.valueOf()).toBe(
      'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
    );
  });

  it('does not enable PRF when credential creation returns PRF disabled', async () => {
    const create = jest
      .fn()
      .mockResolvedValue(
        new FakePublicKeyCredential(credentialRawId, { enabled: false }),
      );
    installWebAuthn({ create, get: jest.fn() });
    const protector = new WebAuthnPrfKeyProtector();

    await expect(
      protector.createProtection({
        displayName: 'Hasko',
        identityId: 'identity-1',
      }),
    ).rejects.toThrow('WebAuthn PRF');
  });

  it('fails PRF unlock when assertion returns no first PRF result', async () => {
    const get = jest
      .fn()
      .mockResolvedValue(new FakePublicKeyCredential(credentialRawId, {}));
    installWebAuthn({ create: jest.fn(), get });
    const protector = new WebAuthnPrfKeyProtector();

    await expect(
      protector.evaluateKey({
        algorithm: 'webauthn-prf',
        credentialId: 'AQIDBAUGBwgJCgsM',
        salt: 'AQID',
        version: 1,
      }),
    ).rejects.toThrow('WebAuthn PRF');
  });
});
