import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonCallSealingApi } from '../../../../../contexts/calls/infrastructure/signals/PigeonCallSealingApi';

const session = { identity: { id: 'alice' } } as unknown as Session;
const build = (responses: unknown[]) => {
  const request = jest.fn();

  for (const response of responses) request.mockResolvedValueOnce(response);
  const signer = {
    headers: jest.fn().mockResolvedValue({ 'x-signed': '1' }),
  } as unknown as jest.Mocked<RequestSigner>;

  return {
    api: new PigeonCallSealingApi(
      { request } as unknown as HttpJsonClient,
      signer,
    ),
    request,
    signer,
  };
};

describe(PigeonCallSealingApi.name, () => {
  it('publishes a signed sealing record for the signed identity', async () => {
    const { api, request, signer } = build([undefined]);
    const record = {
      deviceCredential: 'device-a',
      sealingPublicKey: 'key',
      signature: 'sig',
      utcDay: '2026-10-04',
    };

    await api.publishRecord(session, record);

    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/identity-devices/alice/sealing-records',
      record,
    );
    expect(request).toHaveBeenCalledWith(
      '/identity-devices/alice/sealing-records',
      expect.objectContaining({
        body: JSON.stringify(record),
        headers: expect.objectContaining({ 'x-signed': '1' }),
        method: 'PUT',
      }),
    );
  });

  it('reads the public sealing view without signing', async () => {
    const view = { devices: [], identityId: 'bob', revision: 2 };
    const { api, request, signer } = build([view]);

    expect(await api.sealingView('bob')).toEqual(view);
    expect(request).toHaveBeenCalledWith('/identity-devices/bob/sealing-view');
    expect(signer.headers).not.toHaveBeenCalled();
  });

  it('pages the transition log with the cursor until it is exhausted and merges the pages', async () => {
    const { api, request } = build([
      {
        concurrentRecoveries: [],
        identityId: 'bob',
        nextCursor: 'c1',
        recoveries: [],
        transitions: [{ revision: 1 }],
      },
      {
        concurrentRecoveries: [],
        identityId: 'bob',
        recoveries: [],
        transitions: [{ revision: 2 }],
      },
    ]);

    const log = await api.transitions(session, 'bob');

    expect(log.transitions).toEqual([{ revision: 1 }, { revision: 2 }]);
    expect(request.mock.calls[0][0]).toBe(
      '/identity-devices/bob/transitions?limit=100',
    );
    expect(request.mock.calls[1][0]).toBe(
      '/identity-devices/bob/transitions?limit=100&cursor=c1',
    );
  });
});
