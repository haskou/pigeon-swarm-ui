import {
  DeviceCredentialCommitment,
  IdentitySignature,
  KeyPair,
  PublicKey,
  RecoveryKey,
  Signature,
  SymmetricKey,
  ProofOfWork,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { Identity } from '../../../../../contexts/identities/domain/Identity';
import { IdentityAdmissionDifficultyPolicy } from '../../../../../contexts/identities/domain/IdentityAdmissionDifficultyPolicy';
import { IdentityProfile } from '../../../../../contexts/identities/domain/profile/IdentityProfile';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DeviceUnlockSecretHandle } from '../../../../../contexts/identities/domain/value-objects/DeviceUnlockSecretHandle';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityMasterKeyProtection } from '../../../../../contexts/identities/domain/value-objects/IdentityMasterKeyProtection';
import { IdentityNetworkMemberships } from '../../../../../contexts/identities/domain/value-objects/IdentityNetworkMemberships';
import { IdentityRegistrationCode } from '../../../../../contexts/identities/domain/value-objects/IdentityRegistrationCode';
import { IdentitySignaturePayloadFactory } from '../../../../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';
import { PigeonIdentityCommandsApi } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityCommandsApi';
import { PigeonIdentityGateway } from '../../../../../contexts/identities/infrastructure/http/PigeonIdentityGateway';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

function identity(overrides: Partial<IdentityResource> = {}): IdentityResource {
  return {
    admissionNonce: '0',
    authorizationRevision: 0,
    deviceCredential: 'device-credential',
    deviceCredentialCommitment: 'device-credential-commitment',
    id: 'public-key',
    networks: ['network-1'],
    profile: { name: 'Ada' },
    recoveryAuthority: 'recovery-authority',
    signature: 'signature',
    timestamp: 1,
    version: 1,
    ...overrides,
  };
}

function expectIdentitySigned(http: HttpJsonClient, keyPair: KeyPair): void {
  const { signature, ...unsigned } = JSON.parse(
    String(jest.mocked(http.request).mock.calls[0]?.[1]?.body),
  ) as IdentityResource;

  expect(() =>
    IdentitySignature.verify(
      IdentitySignaturePayloadFactory.payloadOf(unsigned),
      new Signature(signature),
      new PublicKey(keyPair.toPrimitives().publicKey),
    ),
  ).not.toThrow();
}

describe(PigeonIdentityCommandsApi.name, () => {
  it('creates and signs identity material through the identity boundary', async () => {
    const createdIdentity = identity();
    const http = {
      request: jest.fn().mockResolvedValue(createdIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
    } as unknown as RequestSigner;
    const vault = {
      delete: jest.fn(),
      register: jest.fn().mockImplementation(({ material }) =>
        Promise.resolve({
          authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
          authorizationRevision: DeviceAuthorizationRevision.initial(),
          deviceId: DeviceId.generate(),
          material,
          secretHandle: DeviceUnlockSecretHandle.generate(),
        }),
      ),
    } as unknown as DeviceIdentityVault;
    const commands = new PigeonIdentityCommandsApi(
      http,
      signer,
      new PigeonIdentityGateway(http),
      new IdentitySignaturePayloadFactory(),
      vault,
    );

    const created = await commands.create(
      'Ada',
      'password',
      ['network-1'],
      '@ada',
      { recoveryKey: RecoveryKey.generate().valueOf() },
    );

    expect(created).toMatchObject({
      authorizationEpoch: expect.any(Object),
      authorizationRevision: expect.any(Object),
      deviceCredentialKeyPair: expect.any(KeyPair),
      deviceId: expect.any(Object),
      identity: createdIdentity,
      keyPair: expect.any(KeyPair),
      masterKey: expect.any(SymmetricKey),
      recoveryAuthorityKeyPair: expect.any(KeyPair),
    });
    expectIdentitySigned(http, created.keyPair);

    expect(vault.register).toHaveBeenCalledWith(
      expect.objectContaining({ firstKeychainPublish: 'armed' }),
    );

    expect(http.request).toHaveBeenCalledWith(
      '/identities',
      expect.objectContaining({
        body: expect.not.stringContaining('encryptedMasterKey'),
        method: 'POST',
      }),
    );
    expect(signer.headers).toHaveBeenCalledWith(
      expect.objectContaining({ keyPair: expect.any(KeyPair) }),
      'POST',
      '/identities',
      expect.any(Object),
    );
  });

  it('refreshes, signs, and caches profile updates at the identity boundary', async () => {
    const keyPair = await KeyPair.generate();
    const deviceCredential = (await KeyPair.generate()).toPrimitives()
      .publicKey;
    const id = IdentityId.normalize(keyPair.toPrimitives().publicKey);
    const currentIdentity = identity({
      deviceCredential,
      deviceCredentialCommitment: DeviceCredentialCommitment.of(
        new PublicKey(deviceCredential),
      ),
      id,
      identityExternalIdentifier: 'identity-cid',
      recoveryAuthority: (await KeyPair.generate()).toPrimitives().publicKey,
    });
    const updatedIdentity = identity({
      id,
      identityExternalIdentifier: 'updated-identity-cid',
      profile: { name: 'Ada Next' },
      version: 2,
    });
    const http = {
      request: jest.fn().mockResolvedValueOnce(updatedIdentity),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
    } as unknown as RequestSigner;
    const identities = {
      get: jest.fn().mockResolvedValue(currentIdentity),
      remember: jest.fn(),
    } as unknown as PigeonIdentityGateway;
    const vault = {} as DeviceIdentityVault;
    const session = {
      identity: currentIdentity,
      keychain: { conversations: {}, version: 0 },
      keyPair,
      masterKey: SymmetricKey.generate(),
    } as Session;
    const commands = new PigeonIdentityCommandsApi(
      http,
      signer,
      identities,
      new IdentitySignaturePayloadFactory(),
      vault,
    );

    await expect(
      commands.updateProfile(session, { name: 'Ada Next' }, undefined, {}),
    ).resolves.toBe(updatedIdentity);

    expect(http.request).toHaveBeenCalledWith(
      `/identities/${encodeURIComponent(id)}`,
      expect.objectContaining({ method: 'PUT' }),
    );
    expectIdentitySigned(http, keyPair);
    expect(identities.remember).toHaveBeenCalledWith(updatedIdentity);
  });
});

describe(`${PigeonIdentityCommandsApi.name} admission difficulty`, () => {
  function busy(requiredDifficultyBits: number): HttpJsonError {
    return new HttpJsonError(
      400,
      'Bad Request',
      JSON.stringify({ httpStatus: 400, requiredDifficultyBits }),
    );
  }

  function vault(): DeviceIdentityVault {
    return {
      delete: jest.fn(),
      register: jest.fn().mockImplementation(({ material }) =>
        Promise.resolve({
          authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
          authorizationRevision: DeviceAuthorizationRevision.initial(),
          deviceId: DeviceId.generate(),
          material,
          secretHandle: DeviceUnlockSecretHandle.generate(),
        }),
      ),
    } as unknown as DeviceIdentityVault;
  }

  function commandsWith(
    http: HttpJsonClient,
    identities: PigeonIdentityGateway = new PigeonIdentityGateway(http),
    deviceVault: DeviceIdentityVault = vault(),
  ): PigeonIdentityCommandsApi {
    return new PigeonIdentityCommandsApi(
      http,
      {
        headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
      } as unknown as RequestSigner,
      identities,
      new IdentitySignaturePayloadFactory(),
      deviceVault,
    );
  }

  function sentBody(http: HttpJsonClient, call: number): IdentityResource {
    return JSON.parse(
      String(jest.mocked(http.request).mock.calls[call][1]?.body),
    ) as IdentityResource;
  }

  let defaultDifficulty: { restore: () => void };

  // Real PoW at the 16-bit protocol default is slow on loaded runners. The
  // retry only needs the default below the re-mined value, so lower it here.
  beforeEach(() => {
    defaultDifficulty = jest.replaceProperty<
      { DEFAULT_DIFFICULTY_BITS: number },
      'DEFAULT_DIFFICULTY_BITS'
    >(IdentityAdmissionDifficultyPolicy, 'DEFAULT_DIFFICULTY_BITS', 8);
  });

  afterEach(() => {
    defaultDifficulty.restore();
    jest.restoreAllMocks();
  });

  it('re-mines a created identity at the requested difficulty and reports progress', async () => {
    const http = {
      request: jest
        .fn()
        .mockRejectedValueOnce(busy(9))
        .mockResolvedValueOnce(identity()),
    } as unknown as HttpJsonClient;
    const commands = commandsWith(http);
    const progress = jest.fn();
    const stop = commands.watchAdmissionProgress(progress);

    await commands.create('Ada', 'password', ['network-1'], undefined, {
      recoveryKey: RecoveryKey.generate().valueOf(),
    });
    stop();

    const retried = sentBody(http, 1);

    expect(http.request).toHaveBeenCalledTimes(2);
    expect(
      ProofOfWork.identityAdmission(retried.id, retried.networks).verify(
        retried.admissionNonce,
        9,
      ),
    ).toBe(true);
    expect(progress).toHaveBeenCalledWith({
      attempt: 1,
      difficultyBits: 9,
      maximumAttempts: 2,
    });
  });

  it('re-mines a profile update even when its networks are unchanged', async () => {
    const keyPair = await KeyPair.generate();
    const deviceCredential = (await KeyPair.generate()).toPrimitives()
      .publicKey;
    const current = identity({
      deviceCredential,
      deviceCredentialCommitment: DeviceCredentialCommitment.of(
        new PublicKey(deviceCredential),
      ),
      id: IdentityId.normalize(keyPair.toPrimitives().publicKey),
      identityExternalIdentifier: 'identity-cid',
      recoveryAuthority: (await KeyPair.generate()).toPrimitives().publicKey,
    });
    const http = {
      request: jest
        .fn()
        .mockRejectedValueOnce(busy(9))
        .mockResolvedValueOnce(current),
    } as unknown as HttpJsonClient;
    const identities = {
      get: jest.fn().mockResolvedValue(current),
      remember: jest.fn(),
    } as unknown as PigeonIdentityGateway;
    const commands = commandsWith(http, identities);
    const session = {
      identity: current,
      keychain: { conversations: {}, version: 0 },
      keyPair,
      masterKey: SymmetricKey.generate(),
    } as Session;

    await commands.updateProfile(session, { name: 'Ada Next' }, undefined, {});

    const retried = sentBody(http, 1);

    expect(sentBody(http, 0).admissionNonce).toBe('0');
    expect(
      ProofOfWork.identityAdmission(retried.id, retried.networks).verify(
        retried.admissionNonce,
        9,
      ),
    ).toBe(true);
  });

  it('gives up after two re-mined retries', async () => {
    jest.spyOn(ProofOfWork.prototype, 'mint').mockResolvedValue('1');
    const refusal = busy(19);
    const http = {
      request: jest
        .fn()
        .mockRejectedValueOnce(busy(17))
        .mockRejectedValueOnce(busy(18))
        .mockRejectedValueOnce(refusal),
    } as unknown as HttpJsonClient;
    const deviceVault = vault();

    await expect(
      commandsWith(http, undefined, deviceVault).create(
        'Ada',
        'password',
        ['network-1'],
        undefined,
        { recoveryKey: RecoveryKey.generate().valueOf() },
      ),
    ).rejects.toBe(refusal);
    expect(http.request).toHaveBeenCalledTimes(3);
    expect(deviceVault.delete).toHaveBeenCalledTimes(1);
  });

  it('does not mine above 24 bits', async () => {
    const mine = jest.spyOn(ProofOfWork.prototype, 'mint');
    const refusal = busy(25);
    const http = {
      request: jest.fn().mockRejectedValueOnce(refusal),
    } as unknown as HttpJsonClient;

    mine.mockResolvedValue('1');

    await expect(
      commandsWith(http).create('Ada', 'password', ['network-1'], undefined, {
        recoveryKey: RecoveryKey.generate().valueOf(),
      }),
    ).rejects.toBe(refusal);
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(mine).toHaveBeenCalledTimes(1);
  });
});

describe(`${PigeonIdentityCommandsApi.name} registration codes`, () => {
  const registrationCode = 'Q29kZUNvZGVDb2RlQ29kZUNvZGVDb2RlQ29kZUNvZGU';

  async function created(
    http: HttpJsonClient,
    deviceVault: DeviceIdentityVault,
    code: IdentityRegistrationCode | null,
  ): Promise<unknown> {
    const keyPair = await KeyPair.generate();
    const commands = new PigeonIdentityCommandsApi(
      http,
      {
        headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
      } as unknown as RequestSigner,
      new PigeonIdentityGateway(http),
      new IdentitySignaturePayloadFactory(),
      deviceVault,
    );

    return await commands.createIdentity(
      Identity.create(
        IdentityId.fromString(keyPair.toPrimitives().publicKey),
        IdentityProfile.fromPrimitives({
          banner: undefined,
          biography: undefined,
          handle: undefined,
          name: 'Ada',
          picture: undefined,
        }),
        IdentityNetworkMemberships.fromPrimitives(['network-1']),
        new Timestamp(100),
      ),
      {
        deviceCredentialKeyPair: await KeyPair.generate(),
        keyPair,
        masterKey: SymmetricKey.generate(),
        recoveryAuthorityKeyPair: await KeyPair.generate(),
      },
      IdentityMasterKeyProtection.fromPrimitives({
        password: 'Correct-Horse-Battery-9!',
        recoveryKey: RecoveryKey.generate().valueOf(),
      }),
      code,
    );
  }

  function vault(): DeviceIdentityVault {
    return {
      delete: jest.fn(),
      register: jest.fn().mockImplementation(({ material }) =>
        Promise.resolve({
          authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
          authorizationRevision: DeviceAuthorizationRevision.initial(),
          deviceId: DeviceId.generate(),
          material,
          secretHandle: DeviceUnlockSecretHandle.generate(),
        }),
      ),
    } as unknown as DeviceIdentityVault;
  }

  it('sends the registration code only as the sign-up request header', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(identity()),
    } as unknown as HttpJsonClient;

    await created(
      http,
      vault(),
      IdentityRegistrationCode.fromString(registrationCode),
    );

    const init = jest.mocked(http.request).mock.calls[0]?.[1];

    expect(init?.headers).toEqual({
      'X-Registration-Code': registrationCode,
      'X-Signature': 'signed',
    });
    expect(String(init?.body)).not.toContain(registrationCode);
  });

  it('sends no registration code header without a code', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(identity()),
    } as unknown as HttpJsonClient;

    await created(http, vault(), null);

    expect(jest.mocked(http.request).mock.calls[0]?.[1]?.headers).toEqual({
      'X-Signature': 'signed',
    });
  });

  it('marks the identity created on this device as awaiting its first keychain publish', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(identity()),
    } as unknown as HttpJsonClient;
    const deviceVault = vault();

    await created(http, deviceVault, null);

    expect(deviceVault.register).toHaveBeenCalledWith(
      expect.objectContaining({ firstKeychainPublish: 'armed' }),
    );
  });

  it('posts nothing and keeps the local identity when the vault already holds it', async () => {
    const http = {
      request: jest.fn().mockResolvedValue(identity()),
    } as unknown as HttpJsonClient;
    const deviceVault = vault();
    jest
      .mocked(deviceVault.register)
      .mockRejectedValueOnce(new Error('Vault record already exists.'));

    await expect(created(http, deviceVault, null)).rejects.toThrow(
      'Vault record already exists.',
    );
    expect(http.request).not.toHaveBeenCalled();
    expect(deviceVault.delete).not.toHaveBeenCalled();
  });

  it('forgets the local device identity when the node refuses the code', async () => {
    const refusal = new HttpJsonError(
      403,
      'Forbidden',
      JSON.stringify({ code: 403011, httpStatus: 403 }),
    );
    const http = {
      request: jest.fn().mockRejectedValue(refusal),
    } as unknown as HttpJsonClient;
    const deviceVault = vault();

    await expect(
      created(
        http,
        deviceVault,
        IdentityRegistrationCode.fromString(registrationCode),
      ),
    ).rejects.toBe(refusal);
    expect(deviceVault.delete).toHaveBeenCalledTimes(1);
  });
});
