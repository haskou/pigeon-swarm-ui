import { KeyPair } from '@haskou/pigeon-swarm-crypto';
import { mock } from 'jest-mock-extended';

import type {
  NotificationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonNotificationsApi } from '../../../../../contexts/notifications/infrastructure/http/PigeonNotificationsApi';
import { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

describe(PigeonNotificationsApi.name, () => {
  const session = { identity: { id: 'recipient' } } as Session;

  it('starts an independent signed list read while an older startup read is pending', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    const cache = new RequestCache();
    const api = new PigeonNotificationsApi(
      http,
      signer,
      cache.load.bind(cache),
      publicMutationSignerAt(),
    );
    let resolveOld!: (value: { results: NotificationResource[] }) => void;
    const oldResponse = new Promise<{ results: NotificationResource[] }>(
      (resolve) => {
        resolveOld = resolve;
      },
    );
    const invitation = { id: 'invitation' } as NotificationResource;
    http.request
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValue({ results: [invitation] });
    signer.headers.mockResolvedValue({ signature: 'signed' });
    const oldRead = api.list(session);
    await Promise.resolve();
    await Promise.resolve();
    const newRead = api.list(session);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(http.request).toHaveBeenCalledTimes(2);
    expect(await newRead).toEqual([invitation]);
    resolveOld({ results: [] });
    expect(await oldRead).toEqual([]);
    expect(http.request).toHaveBeenLastCalledWith('/notifications/?limit=30', {
      headers: { signature: 'signed' },
      method: 'GET',
    });
  });

  it('retains settings caching', async () => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();
    const cache = new RequestCache();
    const api = new PigeonNotificationsApi(
      http,
      signer,
      cache.load.bind(cache),
      publicMutationSignerAt(),
    );
    http.request.mockResolvedValue({ scopes: [] });

    expect(await api.listSettings(session)).toEqual([]);
    expect(await api.listSettings(session)).toEqual([]);
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  describe('signed scope settings', () => {
    const build = async () => {
      const http = mock<HttpJsonClient>();
      const signer = mock<RequestSigner>();
      const cache = new RequestCache();
      const api = new PigeonNotificationsApi(
        http,
        signer,
        cache.load.bind(cache),
        publicMutationSignerAt(),
      );
      const signed = {
        deviceCredentialKeyPair: await KeyPair.generate(),
        identity: { id: 'identity-1' },
      } as unknown as Session;

      signer.headers.mockResolvedValue({});
      http.request.mockResolvedValue(undefined);

      return { api, http, signed };
    };

    it('signs a put with the stored document and sends updatedAt', async () => {
      const { api, http, signed } = await build();

      await api.saveSetting(signed, {
        notificationLevel: 'mentions',
        scope: {
          channelId: 'ch',
          communityId: 'co',
          type: 'community_channel',
        },
      } as never);

      const [path, init] = http.request.mock.calls[0];
      const body = JSON.parse(String(init?.body));

      expect(path).toBe('/notification-settings/scopes');
      expect(init?.method).toBe('PUT');
      expect(typeof body.updatedAt).toBe('number');
      expect(body.mutation).toMatchObject({
        kind: 'put',
        predecessor: null,
        recordId: 'identity-1:community_channel:co:ch',
        sequence: 0,
        store: 'notificationSettings',
      });
    });

    it('signs a delete tombstone', async () => {
      const { api, http, signed } = await build();

      await api.resetSetting(signed, {
        conversationId: 'c1',
        type: 'conversation',
      });

      const [, init] = http.request.mock.calls[0];
      const body = JSON.parse(String(init?.body));

      expect(init?.method).toBe('DELETE');
      expect(body.scope).toEqual({
        conversationId: 'c1',
        type: 'conversation',
      });
      expect(body.mutation).toMatchObject({
        kind: 'delete',
        recordId: 'identity-1:conversation:c1',
        store: 'notificationSettings',
      });
    });

    it('signs the recipient state record when updating a notification', async () => {
      const { api, http, signed } = await build();

      await api.update(signed, 'invitation:abc', 'accepted');

      const [path, init] = http.request.mock.calls[0];
      const body = JSON.parse(String(init?.body));

      expect(path).toBe('/notifications/invitation%3Aabc');
      expect(init?.method).toBe('PATCH');
      expect(body.state).toBe('accepted');
      expect(body.mutation).toMatchObject({
        kind: 'put',
        predecessor: null,
        recordId: 'notification-state:invitation:abc:accepted',
        sequence: 0,
        store: 'notifications',
      });
    });
  });
});
