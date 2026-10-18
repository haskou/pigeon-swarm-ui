import { type MockProxy, mock } from 'jest-mock-extended';

import type { CommunityOperationDocument } from '../../../../../contexts/communities/infrastructure/http/CommunityOperationDocument';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';
import type { HttpJsonClient } from '../../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../../shared/infrastructure/http/RequestSigner';

import { PigeonCommunityOperationsApi } from '../../../../../contexts/communities/infrastructure/http/PigeonCommunityOperationsApi';
import { MlsTestIdentity } from '../mls/MlsTestIdentity';
import { CommunityOperationHistory } from './CommunityOperationHistory';

/** One page as the node answers it: its operations and where it continues. */
type ServedPage = { nextCursor?: string | null; operations: unknown[] };

describe(PigeonCommunityOperationsApi.name, () => {
  const session = mock<Session>();
  let cast: Record<string, MlsTestIdentity>;
  let history: CommunityOperationHistory;

  /** A node that serves `pages` in order, one per request. */
  const serving = (pages: ServedPage[]) => {
    const http = mock<HttpJsonClient>();
    const signer = mock<RequestSigner>();

    signer.headers.mockResolvedValue({});
    for (const page of pages) {
      http.request.mockResolvedValueOnce(page);
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
    const { api, http } = serving([{ operations: history.documents }]);

    const operations = await api.list(session, history.communityId);

    expect(operations.map((operation) => operation.getHash())).toEqual(
      history.documents.map(CommunityOperationHistory.digestOf),
    );
    expect(pathsOf(http)).toEqual([
      `/communities/${encodeURIComponent(history.communityId)}/operations?limit=100`,
    ]);
  });

  it('drops what a node forged, altered or malformed', async () => {
    const [genesis, bob, carol] = history.documents;
    const forged: CommunityOperationDocument = {
      ...bob,
      identitySignature: carol.identitySignature,
    };
    const { api } = serving([
      { operations: [genesis, forged, { id: 'x' }, 'junk', carol] },
    ]);

    const operations = await api.list(session, history.communityId);

    expect(operations.map((operation) => operation.getHash())).toEqual(
      [genesis, carol].map(CommunityOperationHistory.digestOf),
    );
  });

  it('pages after the cursor the node serves', async () => {
    const [genesis] = history.documents;
    const full = Array.from({ length: 100 }, () => genesis);
    const { api, http } = serving([
      { nextCursor: 'cursor-1', operations: full },
      { operations: history.documents.slice(1) },
    ]);

    await expect(api.list(session, history.communityId)).resolves.toHaveLength(
      102,
    );
    expect(pathsOf(http)[1]).toContain('cursor=cursor-1');
  });

  it('stops when a node repeats the cursor it was given', async () => {
    const [genesis] = history.documents;
    const full = Array.from({ length: 100 }, () => genesis);
    const { api, http } = serving([
      { nextCursor: 'cursor-1', operations: full },
      { nextCursor: 'cursor-1', operations: full },
      { nextCursor: 'cursor-1', operations: full },
    ]);

    await api.list(session, history.communityId);

    expect(http.request).toHaveBeenCalledTimes(2);
  });

  it('reads nothing from a node that answers without operations', async () => {
    const { api } = serving([{ operations: [] }]);

    await expect(api.list(session, history.communityId)).resolves.toEqual([]);
  });
});
