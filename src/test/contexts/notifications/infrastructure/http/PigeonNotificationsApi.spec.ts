import { mock } from 'jest-mock-extended';

import type {
  NotificationResource,
  Session,
} from '../../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonNotificationsApi } from '../../../../../contexts/notifications/infrastructure/http/PigeonNotificationsApi';
import { RequestCache } from '../../../../../shared/infrastructure/http/RequestCache';

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
    );
    http.request.mockResolvedValue({ scopes: [] });

    expect(await api.listSettings(session)).toEqual([]);
    expect(await api.listSettings(session)).toEqual([]);
    expect(http.request).toHaveBeenCalledTimes(1);
  });
});
