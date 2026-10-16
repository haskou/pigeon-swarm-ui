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
});
