import { createHash } from 'crypto';
import { type MockProxy, mock } from 'jest-mock-extended';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { SignedNodeBlockListResource } from '../../../../../contexts/nodeAccess/infrastructure/http/resources/NodeAccessResources';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonNodeAccessApi } from '../../../../../contexts/nodeAccess/infrastructure/http/PigeonNodeAccessApi';

const blockList: SignedNodeBlockListResource = {
  blockedIdentityIds: ['QWxpY2VLZXk='],
  blockedNodePeerIds: [],
  identitySignature: 'list-signature',
  issuedAt: 1,
  ownerIdentityId: 'T3duZXJLZXk=',
  type: 'pigeon-node-block-list',
  version: 2,
};

function apiWith(): {
  api: PigeonNodeAccessApi;
  http: MockProxy<HttpJsonClient>;
  signer: MockProxy<RequestSigner>;
} {
  const http = mock<HttpJsonClient>();
  const signer = mock<RequestSigner>();
  http.request.mockResolvedValue({ blockList });
  signer.headers.mockResolvedValue({
    'X-Identity-Id': 'T3duZXJLZXk=',
    'X-Signature': 'request-signature',
    'X-Timestamp': '1',
  });

  return { api: new PigeonNodeAccessApi(http, signer), http, signer };
}

describe(PigeonNodeAccessApi.name, () => {
  it('declares the hash of the exact body bytes and signs that hash', async () => {
    const { api, http, signer } = apiWith();
    const session = {} as Session;

    await api.putBlockList(blockList, session);

    const [path, init] = http.request.mock.calls[0]!;
    const body = init?.body as string;
    const headers = init?.headers as Record<string, string>;
    const hash = createHash('sha256').update(body, 'utf8').digest('hex');

    expect(path).toBe('/node/blocks');
    expect(JSON.parse(body)).toEqual(blockList);
    expect(headers['X-Body-Hash']).toBe(hash);
    expect(headers['X-Signature']).toBe('request-signature');
    expect(signer.headers).toHaveBeenCalledWith(
      session,
      'PUT',
      '/node/blocks',
      hash,
    );
  });

  it('signs every upload afresh', async () => {
    const { api, signer } = apiWith();

    await api.putBlockList(blockList, {} as Session);
    await api.putBlockList(blockList, {} as Session);

    expect(signer.headers).toHaveBeenCalledTimes(2);
  });

  it('pages each pending array with its own cursor', async () => {
    const { api, http } = apiWith();
    const page = {
      blockedIdentityIds: [],
      blockedIdentityIdsNextCursor: null,
      blockedNodePeerIds: [],
      blockedNodePeerIdsNextCursor: null,
      ownerIdentityId: 'T3duZXJLZXk=',
      version: 3,
    };

    http.request.mockImplementation((path: string) => {
      const query = new URL(path, 'https://node.test').searchParams;

      if (query.has('blockedIdentityIdsLimit')) {
        return Promise.resolve(
          query.has('blockedIdentityIdsCursor')
            ? { ...page, blockedIdentityIds: ['bob'] }
            : {
                ...page,
                blockedIdentityIds: ['alice'],
                blockedIdentityIdsNextCursor: 'identity-2',
              },
        );
      }

      return Promise.resolve({ ...page, blockedNodePeerIds: ['peer-1'] });
    });

    await expect(
      api.getPendingEntries('T3duZXJLZXk=', {} as Session),
    ).resolves.toEqual({
      blockedIdentityIds: ['alice', 'bob'],
      blockedNodePeerIds: ['peer-1'],
      ownerIdentityId: 'T3duZXJLZXk=',
      version: 3,
    });
    expect(http.request.mock.calls.map(([path]) => path)).toEqual([
      '/node/block-sources/T3duZXJLZXk%3D/pending-entries?blockedIdentityIdsLimit=100',
      '/node/block-sources/T3duZXJLZXk%3D/pending-entries?blockedIdentityIdsLimit=100&blockedIdentityIdsCursor=identity-2',
      '/node/block-sources/T3duZXJLZXk%3D/pending-entries?blockedNodePeerIdsLimit=100',
    ]);
  });

  it('follows block source pages until the node reports no next cursor', async () => {
    const { api, http } = apiWith();

    http.request.mockImplementation((path: string) =>
      Promise.resolve(
        new URL(path, 'https://node.test').searchParams.has('cursor')
          ? { nextCursor: null, sources: [{ ownerIdentityId: 'bob' }] }
          : {
              nextCursor: 'sources-2',
              sources: [{ ownerIdentityId: 'alice' }],
            },
      ),
    );

    await expect(api.getSources({} as Session)).resolves.toEqual([
      { ownerIdentityId: 'alice' },
      { ownerIdentityId: 'bob' },
    ]);
    expect(http.request.mock.calls.map(([path]) => path)).toEqual([
      '/node/block-sources?limit=100',
      '/node/block-sources?limit=100&cursor=sources-2',
    ]);
  });
});
