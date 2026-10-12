import { KeyPair, SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { Timestamp } from '@haskou/value-objects';

import type { DeviceIdentityVault } from '../../../../../contexts/identities/infrastructure/storage/DeviceIdentityVault';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { DeviceAuthorizationTransition } from '../../../../../contexts/identities/domain/DeviceAuthorizationTransition';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationOperationId } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationOperationId';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { DeviceId } from '../../../../../contexts/identities/domain/value-objects/DeviceId';
import { DevicePairingCode } from '../../../../../contexts/identities/domain/value-objects/DevicePairingCode';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { IdentityPassword } from '../../../../../contexts/identities/domain/value-objects/IdentityPassword';
import { PairingId } from '../../../../../contexts/identities/domain/value-objects/PairingId';
import { RecoveryKey } from '../../../../../contexts/identities/domain/value-objects/RecoveryKey';
import { RecoveryIdentityMaterial } from '../../../../../contexts/identities/infrastructure/crypto/RecoveryIdentityMaterial';
import { PigeonDeviceAuthorizationApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceAuthorizationApi';

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
    const material = await RecoveryIdentityMaterial.derive(recoveryKey);
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
    );
    const paired = await targetApi.completePairing(
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
    const authorized = await authorApi.authorizePairing(session, requestCode);

    await expect(
      authorApi.authorizePairing(authorized.session, requestCode),
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
      authorApi.authorizePairing(otherDevice, draft.getRequest().toCode()),
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
      lateAuthor.authorizePairing(session, draft.getRequest().toCode()),
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

    it('refuses to revoke itself or a frontier in the future', async () => {
      const target = await KeyPair.generate();
      const { api, http, session } = await managed([checkpoint(3)]);

      await expect(
        api.revokeDevice(
          session,
          DeviceCredential.fromString(
            session.deviceCredentialKeyPair.toPrimitives().publicKey,
          ),
        ),
      ).rejects.toThrow('cannot revoke itself');
      await expect(
        api.revokeDevice(
          session,
          DeviceCredential.fromString(target.toPrimitives().publicKey),
          DeviceAuthorizationRevision.fromNumber(9),
        ),
      ).rejects.toThrow('in the future');
      expect(http).toHaveBeenCalledTimes(1);
    });
  });
});
