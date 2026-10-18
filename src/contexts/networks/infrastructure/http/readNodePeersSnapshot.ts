import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { NodePeersSnapshot } from './NodePeersSnapshot';

import { prefixedPagedPath } from '../../../../shared/infrastructure/http/pagedPath';
import { readAllPages } from '../../../../shared/infrastructure/http/readAllPages';

type PeersPage = {
  ipfsPeers?: NodePeersSnapshot['ipfsPeers'];
  ipfsPeersNextCursor?: string | null;
  networkSynchronization?: NodePeersSnapshot['networkSynchronization'];
  peers?: NodePeersSnapshot['peers'];
  peersNextCursor?: string | null;
};

/**
 * Reads `GET /peers` in full. Its two arrays page on their own, so each is
 * followed to its end; each response also carries the other array's first
 * page, which is not read here.
 */
export async function readNodePeersSnapshot(
  http: HttpJsonClient,
): Promise<NodePeersSnapshot> {
  const path = '/peers';
  const peerPages = await readAllPages<
    PeersPage & { nextCursor: string | null }
  >(async (cursor) => {
    const page = await http.request<PeersPage>(
      prefixedPagedPath(path, 'peers', cursor),
    );

    return { ...page, nextCursor: page.peersNextCursor ?? null };
  });
  const ipfsPeerPages = await readAllPages<
    PeersPage & { nextCursor: string | null }
  >(async (cursor) => {
    const page = await http.request<PeersPage>(
      prefixedPagedPath(path, 'ipfsPeers', cursor),
    );

    return { ...page, nextCursor: page.ipfsPeersNextCursor ?? null };
  });

  return {
    ipfsPeers: ipfsPeerPages.flatMap((page) => page.ipfsPeers ?? []),
    networkSynchronization: peerPages[0]?.networkSynchronization ?? null,
    peers: peerPages.flatMap((page) => page.peers ?? []),
  };
}
