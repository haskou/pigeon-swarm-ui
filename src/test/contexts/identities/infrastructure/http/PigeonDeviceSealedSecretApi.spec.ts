import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { DeviceSealedSecretPublicationResource } from '../../../../../contexts/identities/infrastructure/http/resources/DeviceSealedSecretResource';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { DeviceSealedSecretCipher } from '../../../../../contexts/identities/infrastructure/crypto/DeviceSealedSecretCipher';
import { PigeonDeviceSealedSecretApi } from '../../../../../contexts/identities/infrastructure/http/PigeonDeviceSealedSecretApi';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

describe(PigeonDeviceSealedSecretApi.name, () => {
  const payload = 'fresh-mailbox-root-secret';

  async function fixture() {
    const identityKeyPair = await KeyPair.generate();
    const identityId = IdentityId.fromString(
      identityKeyPair.toPrimitives().publicKey,
    );
    const deviceCredentialKeyPair = await KeyPair.generate();
    const otherDevice = await KeyPair.generate();
    const session = {
      authorizationEpoch: DeviceAuthorizationEpoch.genesis(),
      authorizationRevision: DeviceAuthorizationRevision.fromNumber(2),
      deviceCredentialKeyPair,
      identity: { id: identityId.valueOf() },
    } as Session;
    const recipients = [deviceCredentialKeyPair, otherDevice].map((pair) =>
      DeviceCredential.fromString(pair.toPrimitives().publicKey),
    );
    const path = `/identity-devices/${encodeURIComponent(identityId.valueOf())}/sealed-secrets`;
    const http = { request: jest.fn() };
    const signer = {
      headersWithDeviceProof: jest
        .fn()
        .mockResolvedValue({ 'X-Device-Signature': 'device-signed' }),
    };
    const api = new PigeonDeviceSealedSecretApi(
      http as unknown as HttpJsonClient,
      signer as unknown as RequestSigner,
    );

    return {
      api,
      http,
      identityId,
      otherDevice,
      path,
      recipients,
      session,
      signer,
    };
  }

  it('publishes one generation with device proof at the session revision', async () => {
    const { api, http, identityId, path, recipients, session, signer } =
      await fixture();
    http.request.mockResolvedValue({
      authorizationRevision: 2,
      generation: 3,
      identityId: identityId.valueOf(),
    });

    await api.publish(session, { generation: 3, payload, recipients });

    expect(signer.headersWithDeviceProof).toHaveBeenCalledWith(
      session,
      'PUT',
      path,
      expect.objectContaining({ authorizationRevision: 2, generation: 3 }),
    );
    const [requestPath, init] = http.request.mock.calls[0] as [
      string,
      { body: string; headers: unknown; method: string },
    ];
    const body = JSON.parse(init.body) as DeviceSealedSecretPublicationResource;

    expect(requestPath).toBe(path);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'X-Device-Signature': 'device-signed' });
    expect(body).toEqual({
      authorizationRevision: 2,
      entries: expect.any(Array),
      generation: 3,
    });
    expect(body.entries.map((entry) => entry.recipientCredential)).toEqual(
      recipients.map((recipient) =>
        IdentityId.fromString(recipient.valueOf()).valueOf(),
      ),
    );
    expect(JSON.stringify(body)).not.toContain(payload);
  });

  it('rejects a publish acknowledgement for another generation', async () => {
    const { api, http, identityId, recipients, session } = await fixture();
    http.request.mockResolvedValue({
      authorizationRevision: 2,
      generation: 4,
      identityId: identityId.valueOf(),
    });

    await expect(
      api.publish(session, { generation: 3, payload, recipients }),
    ).rejects.toThrow('Unexpected device sealed secret publication.');
  });

  it('does not retry a conflicting publish', async () => {
    const { api, http, recipients, session } = await fixture();
    http.request.mockRejectedValue(
      new HttpJsonError(
        409,
        'Conflict',
        '{"code":"DeviceSealedSecretGenerationStaleError"}',
      ),
    );

    await expect(
      api.publish(session, { generation: 3, payload, recipients }),
    ).rejects.toBeInstanceOf(HttpJsonError);
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('seals a hand-over that the remaining devices open as signed by the retiring device at the retirement revision', async () => {
    const { api, http, identityId, otherDevice, recipients, session } =
      await fixture();
    const remaining = recipients[1]!;

    const handOver = api.sealHandOver(session, {
      authorizationRevision: 3,
      generation: 7,
      payload,
      recipients: [remaining],
    });

    expect(http.request).not.toHaveBeenCalled();
    expect(handOver.generation).toBe(7);
    expect(handOver.entries).toHaveLength(1);
    expect(JSON.stringify(handOver)).not.toContain(payload);
    expect(
      DeviceSealedSecretCipher.open({
        identityId: identityId.valueOf(),
        recipient: otherDevice,
        resource: {
          ...handOver.entries[0]!,
          authorizationRevision: 3,
          generation: 7,
          identityId: identityId.valueOf(),
          publisherCredential: IdentityId.fromString(
            session.deviceCredentialKeyPair.toPrimitives().publicKey,
          ).valueOf(),
        },
      }),
    ).toEqual({ authorizationRevision: 3, generation: 7, payload });
  });

  it('returns null when no entry exists for the caller', async () => {
    const { api, http, session } = await fixture();
    http.request.mockRejectedValue(new HttpJsonError(404, 'Not Found', ''));

    await expect(api.fetchOwn(session)).resolves.toBeNull();
  });

  it('fetches with device proof and opens the caller entry', async () => {
    const {
      api,
      http,
      identityId,
      otherDevice,
      path,
      recipients,
      session,
      signer,
    } = await fixture();
    const [entry] = DeviceSealedSecretCipher.seal({
      authorizationRevision: 2,
      generation: 3,
      identityId: identityId.valueOf(),
      payload,
      publisher: otherDevice,
      recipients: [recipients[0]!],
    });
    const publisherCredential = IdentityId.fromString(
      otherDevice.toPrimitives().publicKey,
    ).valueOf();
    http.request.mockResolvedValue({
      authorizationRevision: 2,
      generation: 3,
      identityId: identityId.valueOf(),
      publisherCredential,
      recipientCredential: entry!.recipientCredential,
      sealedSecret: entry!.sealedSecret,
      signature: entry!.signature,
    });

    await expect(api.fetchOwn(session)).resolves.toEqual({
      authorizationRevision: 2,
      generation: 3,
      payload,
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
  });
});
