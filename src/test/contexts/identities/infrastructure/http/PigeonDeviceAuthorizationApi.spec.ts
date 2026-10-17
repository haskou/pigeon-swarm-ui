import {
  DeviceCredentialCommitment,
  IdentitySignature,
  KeyPair,
  PrivateKey,
  PublicKey,
  RecoveryKey,
  RecoveryKit,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';
import { mock } from 'jest-mock-extended';

import type { DeviceAuthorizationTransitionLogPrimitives } from '../../../../../contexts/identities/domain/DeviceAuthorizationTransitionLogPrimitives';
import type { DeviceAuthorizationTransitionPrimitives } from '../../../../../contexts/identities/domain/DeviceAuthorizationTransitionPrimitives';
import type { IdentityResource } from '../../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { LocalKeychain } from '../../../../../contexts/identities/infrastructure/keychain/LocalKeychain';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { DeviceAuthorizationTransition } from '../../../../../contexts/identities/domain/DeviceAuthorizationTransition';
import { DeviceRemovedError } from '../../../../../contexts/identities/domain/DeviceRemovedError';
import { IdentityPasswordTooShortError } from '../../../../../contexts/identities/domain/errors/IdentityPasswordTooShortError';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DevicePairingCode } from '../../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPassword } from '../../../../../contexts/identities/domain/value-objects/IdentityPassword';
import { PairingId } from '../../../../../contexts/identities/domain/value-objects/PairingId';
import { IdentitySignaturePayloadFactory } from '../../../../../contexts/identities/infrastructure/http/IdentitySignaturePayloadFactory';
import { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';
import { copy } from '../../../../../shared/presentation/i18n/copy';

function rejectionOf(status: number, code: number): HttpJsonError {
  return new HttpJsonError(
    status,
    'Rejected',
    `{"code":${code},"message":"Rejected."}`,
  );
}

describe(PigeonDeviceAuthorizationApi.name, () => {
  async function fixture() {
    const identityKeyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(
      identityKeyPair.toPrimitives().publicKey,
    );
    const deviceCredentialKeyPair = await KeyPair.generate();
    const recoveryAuthorityKeyPair = await KeyPair.generate();
    const session = {
      authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
      authorizationRevision: DeviceAuthorizationRevision.initial(),
      deviceCredentialKeyPair,
      deviceId: DeviceId.generate(),
      identity: { id: identityId.valueOf() },
      keyPair: identityKeyPair,
      masterKey: SymmetricKey.generate(),
      recoveryAuthorityKeyPair,
    } as Session;
    const transition = DeviceAuthorizationTransition.enrollment({
      author: deviceCredentialKeyPair,
      authorizedAt: new Timestamp(100),
      epoch: session.authorizationEpoch,
      identityId,
      operationId: DeviceAuthorizationOperationId.generate(),
      pairingExpiration: new Timestamp(200),
      pairingId: PairingId.generate(),
      previousRevision: session.authorizationRevision,
      target: await KeyPair.generate(),
    });

    return { identityId, session, transition };
  }

  async function pairing() {
    const { identityId, session } = await fixture();
    const identity = {
      admissionNonce: '0',
      authorizationRevision: 0,
      deviceCredential:
        session.deviceCredentialKeyPair.toPrimitives().publicKey,
      deviceCredentialCommitment: 'commitment',
      id: identityId.valueOf(),
      networks: [],
      profile: { name: 'Ada' },
      recoveryAuthority:
        session.recoveryAuthorityKeyPair.toPrimitives().publicKey,
      signature: 'signature',
      timestamp: 1,
      version: 1,
    };
    const http = {
      request: jest
        .fn()
        .mockImplementation((path: string, init: RequestInit) => {
          if (path === '/identity-devices/transitions') {
            const body = JSON.parse(String(init.body)) as {
              epoch: string;
              identityId: string;
              revision: number;
            };

            return Promise.resolve({
              epoch: body.epoch,
              identityId: body.identityId,
              revision: body.revision,
            });
          }

          return Promise.resolve({
            epoch: 'genesis',
            identityId: identityId.valueOf(),
            revision: 1,
          });
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
      headersWithDeviceProof: jest
        .fn()
        .mockResolvedValue({ 'X-Device-Signature': 'device-signed' }),
      headersWithRecoveryProof: jest
        .fn()
        .mockResolvedValue({ 'X-Recovery-Signature': 'recovery-signed' }),
    } as unknown as RequestSigner;
    const authorVault = {
      advanceAuthorization: jest.fn(),
    } as unknown as DeviceIdentityVault;
    const targetVault = {
      register: jest.fn().mockImplementation((input) =>
        Promise.resolve({
          authorizationEpoch: input.authorizationEpoch,
          authorizationRevision: input.authorizationRevision,
          deviceId: DeviceId.generate(),
          material: input.material,
        }),
      ),
    } as unknown as DeviceIdentityVault;

    return {
      apiAt: (now: number, vault: DeviceIdentityVault) =>
        new PigeonDeviceAuthorizationApi(http, signer, vault, () => now),
      authorVault,
      http,
      identity,
      session,
      signer,
      targetVault,
    };
  }

  it('reads only the signed checkpoint for the current identity', async () => {
    const { identityId, session } = await fixture();
    const http = {
      request: jest.fn().mockResolvedValue({
        epoch: 'genesis',
        identityId: identityId.valueOf(),
        revision: 0,
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
      headersWithDeviceProof: jest
        .fn()
        .mockResolvedValue({ 'X-Device-Signature': 'device-signed' }),
      headersWithRecoveryProof: jest
        .fn()
        .mockResolvedValue({ 'X-Recovery-Signature': 'recovery-signed' }),
    } as unknown as RequestSigner;
    const api = new PigeonDeviceAuthorizationApi(
      http,
      signer,
      {} as DeviceIdentityVault,
    );

    const checkpoint = await api.find(session);

    expect(checkpoint.getRevision().valueOf()).toBe(0);
    expect(http.request).toHaveBeenCalledWith(
      `/identity-devices/${encodeURIComponent(identityId.valueOf())}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('persists the exact checkpoint returned for an accepted transition', async () => {
    const { identityId, session, transition } = await fixture();
    const http = {
      request: jest.fn().mockResolvedValue({
        epoch: 'genesis',
        identityId: identityId.valueOf(),
        revision: 1,
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
      headersWithDeviceProof: jest
        .fn()
        .mockResolvedValue({ 'X-Device-Signature': 'device-signed' }),
      headersWithRecoveryProof: jest
        .fn()
        .mockResolvedValue({ 'X-Recovery-Signature': 'recovery-signed' }),
    } as unknown as RequestSigner;
    const vault = {
      advanceAuthorization: jest.fn(),
    } as unknown as DeviceIdentityVault;
    const api = new PigeonDeviceAuthorizationApi(http, signer, vault);

    await api.apply(session, transition);

    expect(vault.advanceAuthorization).toHaveBeenCalledWith(
      identityId,
      expect.objectContaining({ valueOf: expect.any(Function) }),
      expect.objectContaining({ valueOf: expect.any(Function) }),
    );
  });

  it('does not persist a forged or stale response checkpoint', async () => {
    const { session, transition } = await fixture();
    const http = {
      request: jest.fn().mockResolvedValue({
        epoch: 'genesis',
        identityId: session.identity.id,
        revision: 7,
      }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
      headersWithDeviceProof: jest
        .fn()
        .mockResolvedValue({ 'X-Device-Signature': 'device-signed' }),
      headersWithRecoveryProof: jest
        .fn()
        .mockResolvedValue({ 'X-Recovery-Signature': 'recovery-signed' }),
    } as unknown as RequestSigner;
    const vault = {
      advanceAuthorization: jest.fn(),
    } as unknown as DeviceIdentityVault;
    const api = new PigeonDeviceAuthorizationApi(http, signer, vault);

    await expect(api.apply(session, transition)).rejects.toThrow(
      'Unexpected device authorization checkpoint',
    );
    expect(vault.advanceAuthorization).not.toHaveBeenCalled();
  });

  it('replaces lost devices and stores recovered material at the new epoch', async () => {
    const recoveryKey = RecoveryKey.generate();
    const material = RecoveryKit.derive(recoveryKey);
    const identityId = IdentityId.fromString(
      material.identityKeyPair.toPrimitives().publicKey,
    );
    const http = {
      request: jest
        .fn()
        .mockResolvedValueOnce({
          epoch: 'genesis',
          identityId: identityId.valueOf(),
          revision: 4,
        })
        .mockImplementationOnce((_path: string, init: RequestInit) => {
          const body = JSON.parse(String(init.body)) as {
            operationId: string;
          };

          return Promise.resolve({
            epoch: body.operationId,
            identityId: identityId.valueOf(),
            revision: 5,
          });
        }),
    } as unknown as HttpJsonClient;
    const signer = {
      headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
      headersWithDeviceProof: jest
        .fn()
        .mockResolvedValue({ 'X-Device-Signature': 'device-signed' }),
      headersWithRecoveryProof: jest
        .fn()
        .mockResolvedValue({ 'X-Recovery-Signature': 'recovery-signed' }),
    } as unknown as RequestSigner;
    const vault = {
      register: jest.fn().mockImplementation((input) =>
        Promise.resolve({
          authorizationEpoch: input.authorizationEpoch,
          authorizationRevision: input.authorizationRevision,
          deviceId: DeviceId.generate(),
          material: input.material,
        }),
      ),
    } as unknown as DeviceIdentityVault;
    const api = new PigeonDeviceAuthorizationApi(http, signer, vault);
    const identity = {
      admissionNonce: '0',
      authorizationRevision: 0,
      deviceCredential: 'retired-device',
      deviceCredentialCommitment: 'retired-commitment',
      id: identityId.valueOf(),
      networks: [],
      profile: { name: 'Ada' },
      recoveryAuthority:
        material.recoveryAuthorityKeyPair.toPrimitives().publicKey,
      signature: 'signature',
      timestamp: 1,
      version: 1,
    };

    const session = await api.recover(
      identity,
      recoveryKey,
      IdentityPassword.fromString('Strong password 123!'),
    );

    expect(session.authorizationRevision.valueOf()).toBe(5);
    expect(session.keyPair.toPrimitives()).toEqual(
      material.identityKeyPair.toPrimitives(),
    );
    expect(vault.register).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationRevision: expect.objectContaining({
          valueOf: expect.any(Function),
        }),
        identityId,
        password: 'Strong password 123!',
      }),
    );
    const post = (http.request as jest.Mock).mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(post[1].body))).toEqual(
      expect.objectContaining({ operation: 'recover', previousRevision: 4 }),
    );
  });

  it('refuses a weak password before the recovery reaches the node', async () => {
    const recoveryKey = RecoveryKey.generate();
    const material = RecoveryKit.derive(recoveryKey);
    const identityId = IdentityId.fromString(
      material.identityKeyPair.toPrimitives().publicKey,
    );
    const http = { request: jest.fn() } as unknown as HttpJsonClient;
    const vault = { register: jest.fn() } as unknown as DeviceIdentityVault;
    const api = new PigeonDeviceAuthorizationApi(
      http,
      mock<RequestSigner>(),
      vault,
    );
    const identity = {
      admissionNonce: '0',
      authorizationRevision: 0,
      deviceCredential: 'retired-device',
      deviceCredentialCommitment: 'retired-commitment',
      id: identityId.valueOf(),
      networks: [],
      profile: { name: 'Ada' },
      recoveryAuthority:
        material.recoveryAuthorityKeyPair.toPrimitives().publicKey,
      signature: 'signature',
      timestamp: 1,
      version: 1,
    };

    await expect(
      api.recover(identity, recoveryKey, IdentityPassword.fromString('short')),
    ).rejects.toBeInstanceOf(IdentityPasswordTooShortError);
    expect(http.request).not.toHaveBeenCalled();
    expect(vault.register).not.toHaveBeenCalled();
  });

  describe('recovery compromise caps', () => {
    async function recoverAfter(checkpoint: Record<string, unknown>) {
      const recoveryKey = RecoveryKey.generate();
      const material = RecoveryKit.derive(recoveryKey);
      const identityId = IdentityId.fromString(
        material.identityKeyPair.toPrimitives().publicKey,
      );
      const http = {
        request: jest
          .fn()
          .mockResolvedValueOnce({
            epoch: 'genesis',
            identityId: identityId.valueOf(),
            revision: 4,
            ...checkpoint,
          })
          .mockImplementationOnce((_path: string, init: RequestInit) => {
            const body = JSON.parse(String(init.body)) as {
              operationId: string;
            };

            return Promise.resolve({
              epoch: body.operationId,
              identityId: identityId.valueOf(),
              revision: 5,
            });
          }),
      } as unknown as HttpJsonClient;
      const signer = {
        headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
        headersWithDeviceProof: jest
          .fn()
          .mockResolvedValue({ 'X-Device-Signature': 'device-signed' }),
        headersWithRecoveryProof: jest
          .fn()
          .mockResolvedValue({ 'X-Recovery-Signature': 'recovery-signed' }),
      } as unknown as RequestSigner;
      const vault = {
        register: jest.fn().mockImplementation((input) =>
          Promise.resolve({
            authorizationEpoch: input.authorizationEpoch,
            authorizationRevision: input.authorizationRevision,
            deviceId: DeviceId.generate(),
            material: input.material,
          }),
        ),
      } as unknown as DeviceIdentityVault;
      const api = new PigeonDeviceAuthorizationApi(http, signer, vault);

      await api.recover(
        {
          admissionNonce: '0',
          authorizationRevision: 0,
          deviceCredential: 'retired-device',
          deviceCredentialCommitment: 'retired-commitment',
          id: identityId.valueOf(),
          networks: [],
          profile: { name: 'Ada' },
          recoveryAuthority:
            material.recoveryAuthorityKeyPair.toPrimitives().publicKey,
          signature: 'signature',
          timestamp: 1,
          version: 1,
        },
        recoveryKey,
        IdentityPassword.fromString('Strong password 123!'),
      );

      const post = (http.request as jest.Mock).mock.calls[1] as [
        string,
        RequestInit,
      ];

      return JSON.parse(String(post[1].body)) as Record<string, unknown>;
    }

    it('carries the compromised credentials of the authorization into the recovery', async () => {
      const credentials = (
        await Promise.all([KeyPair.generate(), KeyPair.generate()])
      )
        .map((key) => key.toPrimitives().publicKey)
        .sort();
      const compromisedCredentials = [
        { compromisedSince: 1, credential: credentials[0] },
        { compromisedSince: 3, credential: credentials[1] },
      ];

      expect(await recoverAfter({ compromisedCredentials })).toMatchObject({
        compromisedCredentials,
      });
    });

    it('omits compromisedCredentials when the authorization carries none', async () => {
      expect(await recoverAfter({})).not.toHaveProperty(
        'compromisedCredentials',
      );
      expect(
        await recoverAfter({ compromisedCredentials: [] }),
      ).not.toHaveProperty('compromisedCredentials');
    });
  });

  it('pairs a new device through authenticated single-use transfer', async () => {
    const { apiAt, authorVault, identity, session, targetVault } =
      await pairing();
    const password = IdentityPassword.fromString('Strong password 123!');
    const authorApi = apiAt(1_000, authorVault);
    const targetApi = apiAt(1_100, targetVault);
    const draft = await targetApi.requestPairing(
      authorApi.invite(session).toCode(),
    );
    const authorized = await authorApi.authorizePairing(
      session,
      draft.getRequest().toCode(),
      SymmetricKey.generate(),
    );
    const { session: paired } = await targetApi.completePairing(
      identity,
      password,
      draft,
      authorized.completion.toCode(),
    );

    expect(paired.authorizationRevision.valueOf()).toBe(1);
    expect(paired.deviceCredentialKeyPair.toPrimitives()).toEqual(
      draft.getTargetKeyPair().toPrimitives(),
    );
    await expect(
      targetApi.completePairing(
        identity,
        password,
        draft,
        DevicePairingCode.fromString(authorized.completion.toCode().valueOf()),
      ),
    ).rejects.toMatchObject({ failure: 'used' });
  });

  it('hands the history transfer secret from authorization to completion', async () => {
    const { apiAt, authorVault, identity, session, targetVault } =
      await pairing();
    const password = IdentityPassword.fromString('Strong password 123!');
    const authorApi = apiAt(1_000, authorVault);
    const targetApi = apiAt(1_100, targetVault);
    const draft = await targetApi.requestPairing(
      authorApi.invite(session).toCode(),
    );
    const secret = SymmetricKey.generate();
    const authorized = await authorApi.authorizePairing(
      session,
      draft.getRequest().toCode(),
      secret,
    );
    const paired = await targetApi.completePairing(
      identity,
      password,
      draft,
      authorized.completion.toCode(),
    );

    expect(paired.historyTransferSecret?.valueOf()).toBe(secret.valueOf());
  });

  it('names the paired device by the credential it reads its inboxes with', async () => {
    const { apiAt, authorVault, identity, session, targetVault } =
      await pairing();
    const password = IdentityPassword.fromString('Strong password 123!');
    const authorApi = apiAt(1_000, authorVault);
    const targetApi = apiAt(1_100, targetVault);
    const draft = await targetApi.requestPairing(
      authorApi.invite(session).toCode(),
    );
    const authorized = await authorApi.authorizePairing(
      session,
      draft.getRequest().toCode(),
      SymmetricKey.generate(),
    );
    const { session: paired } = await targetApi.completePairing(
      identity,
      password,
      draft,
      authorized.completion.toCode(),
    );

    expect(authorized.credential.valueOf()).toBe(
      paired.deviceCredentialKeyPair.toPrimitives().publicKey,
    );
  });

  it('lets exactly one of two concurrent completions claim a request', async () => {
    const { apiAt, authorVault, identity, session, targetVault } =
      await pairing();
    const password = IdentityPassword.fromString('Strong password 123!');
    const authorApi = apiAt(1_000, authorVault);
    const targetApi = apiAt(1_100, targetVault);
    const draft = await targetApi.requestPairing(
      authorApi.invite(session).toCode(),
    );
    const authorized = await authorApi.authorizePairing(
      session,
      draft.getRequest().toCode(),
      SymmetricKey.generate(),
    );
    const completion = authorized.completion.toCode();

    const attempts = await Promise.allSettled([
      targetApi.completePairing(identity, password, draft, completion),
      targetApi.completePairing(identity, password, draft, completion),
    ]);

    expect(targetVault.register).toHaveBeenCalledTimes(1);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(attempts).toContainEqual(
      expect.objectContaining({
        reason: expect.objectContaining({ failure: 'used' }),
        status: 'rejected',
      }),
    );
  });

  it('refuses to authorize a request again once it has enrolled a device', async () => {
    const { apiAt, authorVault, http, session, targetVault } = await pairing();
    const authorApi = apiAt(1_000, authorVault);
    const draft = await apiAt(1_100, targetVault).requestPairing(
      authorApi.invite(session).toCode(),
    );
    const requestCode = draft.getRequest().toCode();
    const authorized = await authorApi.authorizePairing(
      session,
      requestCode,
      SymmetricKey.generate(),
    );

    await expect(
      authorApi.authorizePairing(
        authorized.session,
        requestCode,
        SymmetricKey.generate(),
      ),
    ).rejects.toMatchObject({ failure: 'mismatch' });
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('refuses to authorize a request from a device other than the invitation author', async () => {
    const { apiAt, authorVault, http, session, targetVault } = await pairing();
    const authorApi = apiAt(1_000, authorVault);
    const draft = await apiAt(1_100, targetVault).requestPairing(
      authorApi.invite(session).toCode(),
    );
    const otherDevice = {
      ...session,
      deviceCredentialKeyPair: await KeyPair.generate(),
    };

    await expect(
      authorApi.authorizePairing(
        otherDevice,
        draft.getRequest().toCode(),
        SymmetricKey.generate(),
      ),
    ).rejects.toMatchObject({ failure: 'mismatch' });
    expect(http.request).not.toHaveBeenCalled();
  });

  it('reports a request authorized after the pairing window closed as expired', async () => {
    const { apiAt, authorVault, http, session, targetVault } = await pairing();
    const invitation = apiAt(1_000, authorVault).invite(session);
    const draft = await apiAt(1_100, targetVault).requestPairing(
      invitation.toCode(),
    );
    const lateAuthor = apiAt(
      invitation.getExpiration().valueOf() + 1,
      authorVault,
    );

    await expect(
      lateAuthor.authorizePairing(
        session,
        draft.getRequest().toCode(),
        SymmetricKey.generate(),
      ),
    ).rejects.toMatchObject({ failure: 'expired' });
    expect(http.request).not.toHaveBeenCalled();
  });

  it('keeps local authorization unchanged when the node rejects the device read', async () => {
    const { session, signer } = await pairing();
    const http = {
      request: jest
        .fn()
        .mockRejectedValue(new Error('Device credential is revoked.')),
    } as unknown as HttpJsonClient;
    const vault = {
      synchronizeAuthorization: jest.fn(),
    } as unknown as DeviceIdentityVault;
    const api = new PigeonDeviceAuthorizationApi(http, signer, vault);

    await expect(api.synchronize(session)).rejects.toThrow(
      'Device credential is revoked.',
    );
    expect(vault.synchronizeAuthorization).not.toHaveBeenCalled();
  });

  describe('device management', () => {
    async function managed(
      responses: Array<(identityId: IdentityId) => unknown>,
    ) {
      const { identityId, session } = await fixture();
      const http = { request: jest.fn() } as unknown as HttpJsonClient;

      for (const response of responses) {
        (http.request as jest.Mock).mockResolvedValueOnce(response(identityId));
      }
      const signer = {
        headers: jest.fn().mockResolvedValue({ 'X-Signature': 'signed' }),
        headersWithDeviceProof: jest.fn().mockResolvedValue({}),
      } as unknown as RequestSigner;
      const vault = {
        advanceAuthorization: jest.fn(),
      } as unknown as DeviceIdentityVault;

      return {
        api: new PigeonDeviceAuthorizationApi(http, signer, vault),
        http: http.request as jest.Mock,
        identityId,
        session: {
          ...session,
          authorizationRevision: DeviceAuthorizationRevision.fromNumber(3),
        } as Session,
      };
    }
    const checkpoint = (revision: number) => (identityId: IdentityId) => ({
      epoch: 'genesis',
      identityId: identityId.valueOf(),
      revision,
    });

    it('lists the owner devices as credentials', async () => {
      const other = await KeyPair.generate();
      const { api, http, session } = await managed([
        (identityId: IdentityId) => ({
          credentials: [
            IdentityId.fromString(other.toPrimitives().publicKey).valueOf(),
          ],
          epoch: 'genesis',
          identityId: identityId.valueOf(),
          revision: 3,
        }),
      ]);

      const devices = await api.findDevices(session);

      expect(http.mock.calls[0][0]).toMatch(/\/devices$/);
      expect(devices.map((device) => device.valueOf())).toEqual([
        other.toPrimitives().publicKey,
      ]);
    });

    it('submits a revocation carrying the compromise revision', async () => {
      const target = await KeyPair.generate();
      const { api, http, session } = await managed([
        checkpoint(3),
        checkpoint(4),
      ]);

      const next = await api.revokeDevice(
        session,
        DeviceCredential.fromString(target.toPrimitives().publicKey),
        DeviceAuthorizationRevision.fromNumber(1),
      );
      const body = JSON.parse(http.mock.calls[1][1].body);

      expect(body).toMatchObject({
        compromisedSince: 1,
        operation: 'revoke',
        previousRevision: 3,
        targetCredential: target.toPrimitives().publicKey,
      });
      expect(next.authorizationRevision.valueOf()).toBe(4);
    });

    it('refuses a frontier in the future', async () => {
      const target = await KeyPair.generate();
      const { api, http, session } = await managed([checkpoint(3)]);

      await expect(
        api.revokeDevice(
          session,
          DeviceCredential.fromString(target.toPrimitives().publicKey),
          DeviceAuthorizationRevision.fromNumber(9),
        ),
      ).rejects.toThrow('in the future');
      expect(http).toHaveBeenCalledTimes(1);
    });

    describe('own retirement', () => {
      const catalog = (identityId: IdentityId, credentials: string[]) => ({
        credentials,
        epoch: 'genesis',
        identityId: identityId.valueOf(),
        revision: 3,
      });
      const handOver = {
        entries: [
          {
            recipientCredential: 'remaining-device',
            sealedSecret: 'sealed',
            signature: 'signed',
          },
        ],
        generation: 7,
      };

      async function revocable() {
        const other = await KeyPair.generate();
        const managedApi = await managed([]);
        const { api, http, identityId, session } = managedApi;
        const own = session.deviceCredentialKeyPair.toPrimitives().publicKey;

        http
          .mockResolvedValueOnce(
            catalog(identityId, [
              IdentityId.fromString(own).valueOf(),
              IdentityId.fromString(other.toPrimitives().publicKey).valueOf(),
            ]),
          )
          .mockResolvedValueOnce(checkpoint(3)(identityId));

        const revocation = await api.prepareOwnRetirement(session);

        if (typeof revocation === 'string') throw new Error(revocation);

        return { ...managedApi, other, own, revocation };
      }

      it('prepares its own revocation at the next revision and the devices that remain, submitting nothing', async () => {
        const { http, other, own, revocation } = await revocable();

        expect(revocation.transition.getResultRevision().valueOf()).toBe(4);
        expect(revocation.transition.toPrimitives()).toMatchObject({
          operation: 'revoke',
          previousRevision: 3,
          targetCredential: own,
        });
        expect(revocation.remaining.map((device) => device.valueOf())).toEqual([
          other.toPrimitives().publicKey,
        ]);
        expect(http).toHaveBeenCalledTimes(2);
      });

      it('submits its own revocation with the sealed root hand-over and reports it delivered once the node stored it', async () => {
        const { api, http, identityId, own, revocation, session } =
          await revocable();

        http.mockResolvedValueOnce({
          ...checkpoint(4)(identityId),
          sealedSecrets: { authorizationRevision: 4, generation: 7 },
        });

        await expect(
          api.retireOwnDevice(session, revocation, handOver),
        ).resolves.toBe(true);

        expect(JSON.parse(String(http.mock.calls[2][1].body))).toEqual({
          ...revocation.transition.toPrimitives(),
          sealedSecrets: handOver,
        });
        expect(JSON.parse(String(http.mock.calls[2][1].body))).toMatchObject({
          operation: 'revoke',
          targetCredential: own,
        });
        expect(http).toHaveBeenCalledTimes(3);
      });

      it('reports the hand-over undelivered when the node applied the retirement without storing it', async () => {
        const { api, http, identityId, revocation, session } =
          await revocable();

        http.mockResolvedValueOnce(checkpoint(4)(identityId));

        await expect(
          api.retireOwnDevice(session, revocation, handOver),
        ).resolves.toBe(false);
      });

      it('reports the hand-over undelivered when the node answers a null hand-over', async () => {
        const { api, http, identityId, revocation, session } =
          await revocable();

        http.mockResolvedValueOnce({
          ...checkpoint(4)(identityId),
          sealedSecrets: null,
        });

        await expect(
          api.retireOwnDevice(session, revocation, handOver),
        ).resolves.toBe(false);
      });

      it('reports the hand-over undelivered when the node confirms another generation or revision', async () => {
        const { api, http, identityId, revocation, session } =
          await revocable();

        http
          .mockResolvedValueOnce({
            ...checkpoint(4)(identityId),
            sealedSecrets: { authorizationRevision: 4, generation: 8 },
          })
          .mockResolvedValueOnce({
            ...checkpoint(4)(identityId),
            sealedSecrets: { authorizationRevision: 5, generation: 7 },
          });

        await expect(
          api.retireOwnDevice(session, revocation, handOver),
        ).resolves.toBe(false);
        await expect(
          api.retireOwnDevice(session, revocation, handOver),
        ).resolves.toBe(false);
      });

      it('submits a plain revocation when there is nothing to hand over', async () => {
        const { api, http, identityId, revocation, session } =
          await revocable();

        http.mockResolvedValueOnce(checkpoint(4)(identityId));

        await expect(api.retireOwnDevice(session, revocation)).resolves.toBe(
          false,
        );
        expect(JSON.parse(String(http.mock.calls[2][1].body))).toEqual(
          revocation.transition.toPrimitives(),
        );
      });

      it('fails when the node applies another revision', async () => {
        const { api, http, identityId, revocation, session } =
          await revocable();

        http.mockResolvedValueOnce(checkpoint(5)(identityId));

        await expect(
          api.retireOwnDevice(session, revocation, handOver),
        ).rejects.toThrow();
      });

      it('reports a device the node no longer accepts as already removed', async () => {
        const { api, http, session } = await managed([]);

        http.mockRejectedValueOnce(
          new HttpJsonError(
            401,
            'Unauthorized',
            '{"code":401020,"message":"Invalid signed request."}',
          ),
        );

        await expect(api.prepareOwnRetirement(session)).resolves.toBe(
          'already-revoked',
        );
        expect(http).toHaveBeenCalledTimes(1);
      });

      it('fails on any other 401', async () => {
        const { api, http, session } = await managed([]);

        http.mockRejectedValueOnce(
          new HttpJsonError(
            401,
            'Unauthorized',
            '{"code":401021,"message":"Missing authentication headers."}',
          ),
        );

        await expect(api.prepareOwnRetirement(session)).rejects.toThrow(
          'Unauthorized',
        );
        expect(http).toHaveBeenCalledTimes(1);
      });

      it('reports a device missing from the catalog as already removed', async () => {
        const other = await KeyPair.generate();
        const { api, http, identityId, session } = await managed([]);

        http.mockResolvedValueOnce(
          catalog(identityId, [
            IdentityId.fromString(other.toPrimitives().publicKey).valueOf(),
          ]),
        );

        await expect(api.prepareOwnRetirement(session)).resolves.toBe(
          'already-revoked',
        );
        expect(http).toHaveBeenCalledTimes(1);
      });

      it('refuses to remove the only device on the identity', async () => {
        const { api, http, identityId, session } = await managed([]);
        const own = session.deviceCredentialKeyPair.toPrimitives().publicKey;

        http.mockResolvedValueOnce(
          catalog(identityId, [IdentityId.fromString(own).valueOf()]),
        );

        await expect(api.prepareOwnRetirement(session)).resolves.toBe(
          'last-device',
        );
        expect(http).toHaveBeenCalledTimes(1);
      });

      it('surfaces any other failed read', async () => {
        const { api, http, session } = await managed([]);

        http.mockRejectedValueOnce(
          new HttpJsonError(503, 'Service Unavailable', ''),
        );

        await expect(api.prepareOwnRetirement(session)).rejects.toThrow('503');
        expect(http).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('synchronize from the signed transition log', () => {
    const failureOf = async (promise: Promise<unknown>): Promise<unknown> =>
      promise.then(
        () => undefined,
        (error: unknown) => error,
      );

    async function publish(
      identityKeyPair: KeyPair,
      input: { deviceCredential: string; recoveryAuthority: string },
    ): Promise<IdentityResource> {
      const unsigned = await new IdentitySignaturePayloadFactory(
        () => undefined,
      ).createInitial({
        deviceCredential: input.deviceCredential,
        deviceCredentialCommitment: DeviceCredentialCommitment.of(
          new PublicKey(input.deviceCredential),
        ),
        id: identityKeyPair.toPrimitives().publicKey,
        networks: [],
        profile: { name: 'Ada' },
        recoveryAuthority: input.recoveryAuthority,
        timestamp: 1,
      });

      return {
        ...unsigned,
        signature: IdentitySignature.sign(
          IdentitySignaturePayloadFactory.payloadOf(unsigned),
          new PrivateKey(identityKeyPair.toPrimitives().privateKey),
        ).toString(),
      };
    }

    /**
     * The genesis device enrolls the laptop at revision 0 and the laptop
     * synchronizes from its verified revision 1.
     */
    async function synchronizing() {
      const identityKeyPair = await KeyPair.generate();
      const identityId = IdentityId.fromString(
        identityKeyPair.toPrimitives().publicKey,
      );
      const genesisDevice = await KeyPair.generate();
      const laptop = await KeyPair.generate();
      const recoveryAuthorityKeyPair = await KeyPair.generate();
      const epoch = DeviceAuthorizationEpoch.genesis();
      const identity = await publish(identityKeyPair, {
        deviceCredential: genesisDevice.toPrimitives().publicKey,
        recoveryAuthority: recoveryAuthorityKeyPair.toPrimitives().publicKey,
      });
      const enrollment = DeviceAuthorizationTransition.enrollment({
        author: genesisDevice,
        authorizedAt: new Timestamp(100),
        epoch,
        identityId,
        operationId: DeviceAuthorizationOperationId.generate(),
        pairingExpiration: new Timestamp(200),
        pairingId: PairingId.generate(),
        previousRevision: DeviceAuthorizationRevision.initial(),
        target: laptop,
      });
      const removalBy = (author: KeyPair): DeviceAuthorizationTransition =>
        DeviceAuthorizationTransition.revocation({
          author,
          epoch,
          identityId,
          operationId: DeviceAuthorizationOperationId.generate(),
          previousRevision: DeviceAuthorizationRevision.fromNumber(1),
          targetCredential: DeviceCredential.fromString(
            laptop.toPrimitives().publicKey,
          ),
        });
      const session: Session = {
        authorizationEpoch: epoch,
        authorizationRevision: DeviceAuthorizationRevision.fromNumber(1),
        deviceCredentialKeyPair: laptop,
        deviceId: DeviceId.generate(),
        identity,
        keychain: mock<LocalKeychain>(),
        keyPair: identityKeyPair,
        masterKey: SymmetricKey.generate(),
        recoveryAuthorityKeyPair,
      };
      const http = mock<HttpJsonClient>();
      const signer = mock<RequestSigner>();
      const vault = mock<DeviceIdentityVault>();
      const logOf = (
        transitions: DeviceAuthorizationTransitionPrimitives[],
      ): DeviceAuthorizationTransitionLogPrimitives => ({
        concurrentRecoveries: [],
        identityId: identityId.valueOf(),
        recoveries: [],
        transitions,
      });

      signer.headersWithDeviceProof.mockResolvedValue({
        'X-Device-Signature': 'device-signed',
      });

      return {
        api: new PigeonDeviceAuthorizationApi(http, signer, vault),
        enrollment,
        genesisDevice,
        http,
        identityId,
        identityKeyPair,
        laptop,
        logOf,
        path: `/identity-devices/${encodeURIComponent(identityId.valueOf())}/transitions`,
        removalBy,
        session,
        signer,
        vault,
      };
    }

    it('reports a removal the genesis device signed above the local revision', async () => {
      const {
        api,
        enrollment,
        genesisDevice,
        http,
        identityId,
        logOf,
        path,
        removalBy,
        session,
        signer,
        vault,
      } = await synchronizing();
      const removal = removalBy(genesisDevice);

      http.request.mockResolvedValueOnce(
        logOf([enrollment.toPrimitives(), removal.toPrimitives()]),
      );

      const failure = await failureOf(api.synchronize(session));

      expect(failure).toBeInstanceOf(DeviceRemovedError);
      expect(failure).toMatchObject({
        identityId: identityId.valueOf(),
        operationId: removal.getOperationId().valueOf(),
      });
      expect(signer.headersWithDeviceProof).toHaveBeenCalledWith(
        session,
        'GET',
        path,
      );
      expect(http.request).toHaveBeenCalledWith(path, {
        headers: { 'X-Device-Signature': 'device-signed' },
        method: 'GET',
      });
      expect(vault.synchronizeAuthorization).not.toHaveBeenCalled();
    });

    it('advances the local authorization to a verified head that still authorizes this device', async () => {
      const {
        api,
        enrollment,
        http,
        identityId,
        laptop,
        logOf,
        session,
        vault,
      } = await synchronizing();
      const later = DeviceAuthorizationTransition.enrollment({
        author: laptop,
        authorizedAt: new Timestamp(300),
        epoch: session.authorizationEpoch,
        identityId,
        operationId: DeviceAuthorizationOperationId.generate(),
        pairingExpiration: new Timestamp(400),
        pairingId: PairingId.generate(),
        previousRevision: DeviceAuthorizationRevision.fromNumber(1),
        target: await KeyPair.generate(),
      });

      http.request.mockResolvedValueOnce(
        logOf([enrollment.toPrimitives(), later.toPrimitives()]),
      );

      const synchronized = await api.synchronize(session);

      expect(synchronized.authorizationRevision.valueOf()).toBe(2);
      expect(vault.synchronizeAuthorization).toHaveBeenCalledWith(
        identityId,
        session.authorizationRevision,
        session.authorizationEpoch,
        synchronized.authorizationRevision,
      );
    });

    it('keeps a device the node withholds the revocation from: a node can only delay the removal', async () => {
      const { api, enrollment, http, logOf, session } = await synchronizing();

      http.request.mockResolvedValueOnce(logOf([enrollment.toPrimitives()]));

      const synchronized = await api.synchronize(session);

      expect(synchronized.authorizationRevision.valueOf()).toBe(1);
    });

    it('names the devices the replayed transitions authorize, never the node list, and stores nothing', async () => {
      const {
        api,
        enrollment,
        genesisDevice,
        http,
        identityId,
        laptop,
        logOf,
        path,
        session,
        vault,
      } = await synchronizing();
      const tablet = await KeyPair.generate();
      const pairing = DeviceAuthorizationTransition.enrollment({
        author: laptop,
        authorizedAt: new Timestamp(300),
        epoch: session.authorizationEpoch,
        identityId,
        operationId: DeviceAuthorizationOperationId.generate(),
        pairingExpiration: new Timestamp(400),
        pairingId: PairingId.generate(),
        previousRevision: DeviceAuthorizationRevision.fromNumber(1),
        target: tablet,
      });
      const revocation = DeviceAuthorizationTransition.revocation({
        author: laptop,
        epoch: session.authorizationEpoch,
        identityId,
        operationId: DeviceAuthorizationOperationId.generate(),
        previousRevision: DeviceAuthorizationRevision.fromNumber(2),
        targetCredential: DeviceCredential.fromString(
          genesisDevice.toPrimitives().publicKey,
        ),
      });

      http.request.mockResolvedValueOnce(
        logOf([
          enrollment.toPrimitives(),
          pairing.toPrimitives(),
          revocation.toPrimitives(),
        ]),
      );

      const devices = await api.verifiedDevices(session);

      expect(devices.map((device) => device.valueOf()).sort()).toEqual(
        [laptop, tablet]
          .map((device) => device.toPrimitives().publicKey)
          .sort(),
      );
      expect(http.request).toHaveBeenCalledTimes(1);
      expect(http.request).toHaveBeenCalledWith(path, {
        headers: { 'X-Device-Signature': 'device-signed' },
        method: 'GET',
      });
      expect(vault.synchronizeAuthorization).not.toHaveBeenCalled();
    });

    it('reports the removal of this device instead of naming any device', async () => {
      const {
        api,
        enrollment,
        genesisDevice,
        http,
        logOf,
        removalBy,
        session,
      } = await synchronizing();

      http.request.mockResolvedValueOnce(
        logOf([
          enrollment.toPrimitives(),
          removalBy(genesisDevice).toPrimitives(),
        ]),
      );

      await expect(api.verifiedDevices(session)).rejects.toBeInstanceOf(
        DeviceRemovedError,
      );
    });

    it('names no device from a log it cannot prove', async () => {
      const { api, http, session } = await synchronizing();

      http.request.mockResolvedValueOnce({ transitions: 'forged' });

      await expect(api.verifiedDevices(session)).rejects.toThrow(
        copy.auth.deviceAuthorizationUnproven,
      );
    });

    describe('the publisher of a device-sealed secret', () => {
      const unauthorized = 'Device sealed secret publisher is not authorized.';
      const revoked =
        'Device sealed secret publisher was revoked after the entry revision.';
      const credentialOf = (pair: KeyPair): DeviceCredential =>
        DeviceCredential.fromString(pair.toPrimitives().publicKey);
      const at = (revision: number): DeviceAuthorizationRevision =>
        DeviceAuthorizationRevision.fromNumber(revision);

      async function revoking(author: 'genesis' | 'laptop') {
        const context = await synchronizing();
        const revocation = DeviceAuthorizationTransition.revocation({
          author: author === 'genesis' ? context.genesisDevice : context.laptop,
          epoch: context.session.authorizationEpoch,
          identityId: context.identityId,
          operationId: DeviceAuthorizationOperationId.generate(),
          previousRevision: at(1),
          targetCredential: credentialOf(context.genesisDevice),
        });

        context.http.request.mockResolvedValue(
          context.logOf([
            context.enrollment.toPrimitives(),
            revocation.toPrimitives(),
          ]),
        );

        return context;
      }

      it('refuses a publisher the signed transitions never authorized, however validly it signed', async () => {
        const { api, enrollment, http, logOf, session } = await synchronizing();
        const minted = await KeyPair.generate();

        http.request.mockResolvedValue(logOf([enrollment.toPrimitives()]));

        await expect(
          api.verifyPublisher(session, credentialOf(minted), at(1)),
        ).rejects.toThrow(unauthorized);
      });

      it('accepts only a device the signed transitions authorize at the entry revision', async () => {
        const { api, enrollment, genesisDevice, http, laptop, logOf, session } =
          await synchronizing();

        http.request.mockResolvedValue(logOf([enrollment.toPrimitives()]));

        await expect(
          api.verifyPublisher(session, credentialOf(genesisDevice), at(0)),
        ).resolves.toBe('authorized');
        await expect(
          api.verifyPublisher(session, credentialOf(laptop), at(1)),
        ).resolves.toBe('authorized');
        await expect(
          api.verifyPublisher(session, credentialOf(laptop), at(0)),
        ).rejects.toThrow(unauthorized);
        await expect(
          api.verifyPublisher(session, credentialOf(laptop), at(5)),
        ).rejects.toThrow(unauthorized);
      });

      it('accepts the hand-over of a device that retired itself at the entry revision, as a retired publisher', async () => {
        const { api, genesisDevice, session } = await revoking('genesis');

        await expect(
          api.verifyPublisher(session, credentialOf(genesisDevice), at(2)),
        ).resolves.toBe('retired');
      });

      it('refuses a device another device revoked at the entry revision', async () => {
        const { api, genesisDevice, session } = await revoking('laptop');

        await expect(
          api.verifyPublisher(session, credentialOf(genesisDevice), at(2)),
        ).rejects.toThrow(unauthorized);
      });

      it('refuses a device another device revoked later, at a revision that still authorized it', async () => {
        const { api, genesisDevice, session } = await revoking('laptop');

        await expect(
          api.verifyPublisher(session, credentialOf(genesisDevice), at(1)),
        ).rejects.toThrow(revoked);
        await expect(
          api.verifyPublisher(session, credentialOf(genesisDevice), at(0)),
        ).rejects.toThrow(revoked);
      });

      it('refuses an entry a device published before it retired itself', async () => {
        const { api, genesisDevice, session } = await revoking('genesis');

        await expect(
          api.verifyPublisher(session, credentialOf(genesisDevice), at(1)),
        ).rejects.toThrow(revoked);
      });

      it('still accepts an earlier entry of a device the head authorizes', async () => {
        const { api, laptop, session } = await revoking('laptop');

        await expect(
          api.verifyPublisher(session, credentialOf(laptop), at(1)),
        ).resolves.toBe('authorized');
        await expect(
          api.verifyPublisher(session, credentialOf(laptop), at(2)),
        ).resolves.toBe('authorized');
      });

      it('refuses any publisher when the log cannot be proven', async () => {
        const { api, genesisDevice, http, session } = await synchronizing();

        http.request.mockResolvedValue({ transitions: 'forged' });

        await expect(
          api.verifyPublisher(session, credentialOf(genesisDevice), at(1)),
        ).rejects.toThrow(copy.auth.deviceAuthorizationUnproven);
      });
    });

    describe('never reports a removal the log does not prove', () => {
      const unprovenBy = async (
        served: (context: Awaited<ReturnType<typeof synchronizing>>) => unknown,
        session?: (
          context: Awaited<ReturnType<typeof synchronizing>>,
        ) => Promise<Session>,
      ): Promise<void> => {
        const context = await synchronizing();

        context.http.request.mockResolvedValueOnce(served(context));

        const failure = await failureOf(
          context.api.synchronize(
            session ? await session(context) : context.session,
          ),
        );

        expect(failure).not.toBeInstanceOf(DeviceRemovedError);
        expect(failure).toEqual(
          new Error(copy.auth.deviceAuthorizationUnproven),
        );
        expect(context.vault.synchronizeAuthorization).not.toHaveBeenCalled();
      };

      it('rejects a removal carrying another transition signature', async () => {
        await unprovenBy(({ enrollment, genesisDevice, logOf, removalBy }) =>
          logOf([
            enrollment.toPrimitives(),
            {
              ...removalBy(genesisDevice).toPrimitives(),
              signature: enrollment.toPrimitives().signature,
            },
          ]),
        );
      });

      it('rejects an unsigned removal', async () => {
        await unprovenBy(({ enrollment, genesisDevice, logOf, removalBy }) => {
          const unsigned = removalBy(genesisDevice).toPrimitives();

          Reflect.deleteProperty(unsigned, 'signature');

          return {
            ...logOf([enrollment.toPrimitives()]),
            transitions: [enrollment.toPrimitives(), unsigned],
          };
        });
      });

      it('rejects a removal at or below the local revision', async () => {
        await unprovenBy(
          ({ enrollment, genesisDevice, logOf, removalBy }) =>
            logOf([
              enrollment.toPrimitives(),
              removalBy(genesisDevice).toPrimitives(),
            ]),
          ({ session }) =>
            Promise.resolve({
              ...session,
              authorizationRevision: DeviceAuthorizationRevision.fromNumber(2),
            }),
        );
      });

      it('rejects a removal signed by a key that was never authorized', async () => {
        const attacker = await KeyPair.generate();

        await unprovenBy(({ enrollment, logOf, removalBy }) =>
          logOf([
            enrollment.toPrimitives(),
            removalBy(attacker).toPrimitives(),
          ]),
        );
      });

      it('rejects a log served for another identity', async () => {
        const other = await KeyPair.generate();

        await unprovenBy(({ enrollment, genesisDevice, logOf, removalBy }) => ({
          ...logOf([
            enrollment.toPrimitives(),
            removalBy(genesisDevice).toPrimitives(),
          ]),
          identityId: IdentityId.fromString(
            other.toPrimitives().publicKey,
          ).valueOf(),
        }));
      });

      it('rejects a genesis the identity key did not sign', async () => {
        const attacker = await KeyPair.generate();

        await unprovenBy(
          ({ enrollment, logOf, removalBy }) =>
            logOf([
              enrollment.toPrimitives(),
              removalBy(attacker).toPrimitives(),
            ]),
          ({ session }) =>
            Promise.resolve({
              ...session,
              identity: {
                ...session.identity,
                deviceCredential: attacker.toPrimitives().publicKey,
                deviceCredentialCommitment: DeviceCredentialCommitment.of(
                  new PublicKey(attacker.toPrimitives().publicKey),
                ),
              },
            }),
        );
      });

      it('rejects an identity record naming another recovery authority', async () => {
        await unprovenBy(
          ({ enrollment, genesisDevice, logOf, removalBy }) =>
            logOf([
              enrollment.toPrimitives(),
              removalBy(genesisDevice).toPrimitives(),
            ]),
          async ({ genesisDevice, identityKeyPair, session }) => ({
            ...session,
            identity: await publish(identityKeyPair, {
              deviceCredential: genesisDevice.toPrimitives().publicKey,
              recoveryAuthority: (await KeyPair.generate()).toPrimitives()
                .publicKey,
            }),
          }),
        );
      });

      it('rejects a malformed log', async () => {
        await unprovenBy(({ identityId }) => ({
          identityId: identityId.valueOf(),
          transitions: 'removed',
        }));
      });
    });

    it.each([
      ['a rejected device signature', rejectionOf(401, 401020)],
      ['an unknown identity', rejectionOf(404, 404001)],
      ['a conflict', rejectionOf(409, 409001)],
      [
        'an unavailable node',
        new HttpJsonError(503, 'Service Unavailable', ''),
      ],
      ['a dropped connection', new TypeError('fetch failed')],
    ])('propagates %s unchanged and never as a removal', async (_, error) => {
      const { api, http, session, vault } = await synchronizing();

      http.request.mockRejectedValueOnce(error);

      await expect(api.synchronize(session)).rejects.toBe(error);
      expect(http.request).toHaveBeenCalledTimes(1);
      expect(vault.synchronizeAuthorization).not.toHaveBeenCalled();
    });
  });
});
