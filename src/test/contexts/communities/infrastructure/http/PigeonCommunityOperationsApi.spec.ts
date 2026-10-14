import { type MockProxy, mock } from 'jest-mock-extended';

import type { CommunityOperationDocument } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationDocument';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonCommunityOperationsApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityOperationsApi';
import { MlsTestIdentity } from '../mls/MlsTestIdentity';
import { CommunityOperationHistory } from './CommunityOperationHistory';

describe(PigeonCommunityOperationsApi.name, () => {
  const session = mock<Session>();
  let cast: Record<string, MlsTestIdentity>;
  let history: CommunityOperationHistory;

  /** A node that serves `pages` in order, one per request. */
  const serving = (pages: unknown[][]) => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();

    signer.headers.mockResolvedValue({});
    for (const operations of pages) {
      http.request.mockResolvedValueOnce({ operations });
    }

    return { api: new PigeonCommunityOperationsApi(http, signer), http };
  };
  const pathsOf = (http: MockProxy<HttpJsonClient>) =>
    http.request.mock.calls.map(([path]) => path);

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['alice', 'bob', 'carol']);
    history = new CommunityOperationHistory(cast.alice);
    history.add(cast.alice, cast.bob);
    history.add(cast.alice, cast.carol);
  });

  it('reads one signed page and keeps every operation that proves itself', async () => {
    const { api, http } = serving([history.documents]);

    const operations = await api.list(session, history.communityId);

    expect(operations.map((operation) => operation.getHash())).toEqual(
      history.documents.map(CommunityOperationHistory.digestOf),
    );
    expect(pathsOf(http)).toEqual([
      `/communities/${encodeURIComponent(history.communityId)}/operations?limit=500`,
    ]);
  });

  it('drops what a node forged, altered or malformed', async () => {
    const [genesis, bob, carol] = history.documents;
    const forged: CommunityOperationDocument = {
      ...bob,
      identitySignature: carol.identitySignature,
    };
    const { api } = serving([[genesis, forged, { id: 'x' }, 'junk', carol]]);

    const operations = await api.list(session, history.communityId);

    expect(operations.map((operation) => operation.getHash())).toEqual(
      [genesis, carol].map(CommunityOperationHistory.digestOf),
    );
  });

  it('pages after the digest of the last operation served', async () => {
    const [genesis] = history.documents;
    const full = Array.from({ length: 500 }, () => genesis);
    const { api, http } = serving([full, history.documents.slice(1)]);

    await expect(api.list(session, history.communityId)).resolves.toHaveLength(
      502,
    );
    expect(pathsOf(http)[1]).toContain(
      `after=${CommunityOperationHistory.digestOf(genesis)}`,
    );
  });

  it('stops when a full page does not move the cursor forward', async () => {
    const [genesis] = history.documents;
    const full = Array.from({ length: 500 }, () => genesis);
    const { api, http } = serving([full, full, full]);

    await api.list(session, history.communityId);

    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('reads nothing from a node that answers without operations', async () => {
    const { api } = serving([[]]);

    await expect(api.list(session, history.communityId)).resolves.toEqual([]);
  });
});
