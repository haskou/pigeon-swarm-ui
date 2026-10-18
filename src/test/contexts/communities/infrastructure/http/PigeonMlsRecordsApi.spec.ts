import { KeyPair } from '@haskou/pigeon-swarm-crypto';

import type { MlsRecordInput } from '../../../../../contexts/communities/infrastructure/http/MlsRecordInput';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonMlsRecordsApi } from '../../../../../contexts/communities/infrastructure/http/PigeonMlsRecordsApi';
import { ScopeFrontierReader } from '../../../../../shared/infrastructure/http/ScopeFrontierReader';
import { publicMutationSignerAt } from '../../../../shared/infrastructure/crypto/publicMutationSignerAt';

const FRONTIER = ['F'.repeat(43)];
const TIMEOUT_MS = 20;
const INPUT: MlsRecordInput = {
  groupId: 'group-a',
  kind: 'key_package',
  payload: 'AAAA',
};

/** Never answers until the request is aborted, like an unresponsive node. */
function stalled(_path: string, init?: RequestInit): Promise<never> {
  const signal = init?.signal;

  return new Promise<never>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason));
  });
}

/** Answers the frontier read and stalls every other request. */
function frontierThenStall(path: string, init?: RequestInit): Promise<unknown> {
  if (path.endsWith('/frontier')) {
    return Promise.resolve({ frontier: FRONTIER });
  }

  return stalled(path, init);
}

async function setup(
  respond: (path: string, init?: RequestInit) => Promise<unknown>,
) {
  const device = await KeyPair.generate();
  const http = { request: jest.fn(respond) } as unknown as HttpJsonClient;
  const signer = {
    headers: jest.fn().mockResolvedValue({ authorization: 'signed' }),
  } as unknown as RequestSigner;
  const session = {
    deviceCredentialKeyPair: device,
    identity: { id: 'identity-a' },
  } as unknown as Session;
  const api = new PigeonMlsRecordsApi(
    http,
    signer,
    publicMutationSignerAt(),
    new ScopeFrontierReader(http, signer),
    TIMEOUT_MS,
  );

  return { api, http, session };
}

describe(PigeonMlsRecordsApi.name, () => {
  it('fails a stalled record read so the group queue is released', async () => {
    const { api, session } = await setup(stalled);

    await expect(
      api.list(session, 'community-a', { groupId: 'group-a' }),
    ).rejects.toHaveProperty('name', 'TimeoutError');
  });

  it('fails a stalled frontier read before any record is published', async () => {
    const { api, http, session } = await setup(stalled);

    await expect(
      api.publish(session, 'community-a', INPUT),
    ).rejects.toHaveProperty('name', 'TimeoutError');
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('fails a stalled record publish', async () => {
    const { api, session } = await setup(frontierThenStall);

    await expect(
      api.publish(session, 'community-a', INPUT),
    ).rejects.toHaveProperty('name', 'TimeoutError');
  });

  it('bounds every record request with a signal and keeps the answer', async () => {
    const { api, http, session } = await setup(() =>
      Promise.resolve({
        communityId: 'community-a',
        groupId: 'group-a',
        records: [],
      }),
    );

    await expect(
      api.list(session, 'community-a', { groupId: 'group-a' }),
    ).resolves.toEqual([]);
    expect(http.request).toHaveBeenCalledWith(
      expect.stringContaining('/mls/records?'),
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
