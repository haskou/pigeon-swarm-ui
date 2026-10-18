import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CommunityOperation } from '../../domain/operations/CommunityOperation';

import { CommunityOperationProof } from './CommunityOperationProof';

/** Operations the node returns per page, its maximum. */
const PAGE_SIZE = 100;

/**
 * Reads the signed operations of one community from the node, the history
 * members replay roles from. Keeps only the operations that prove themselves:
 * a node can withhold operations, never forge or alter one.
 */
export class PigeonCommunityOperationsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  /**
   * The documents the node serves after `cursor`, unverified, and where the
   * next page starts.
   */
  private async page(
    session: Session,
    communityId: string,
    cursor: string | undefined,
  ): Promise<{ nextCursor: string | null; operations: unknown[] }> {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });

    if (cursor !== undefined) params.set('cursor', cursor);

    const path = `/communities/${encodeURIComponent(communityId)}/operations?${params.toString()}`;
    const result = await this.http.request<{
      nextCursor?: string | null;
      operations?: unknown[];
    }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return {
      nextCursor: result.nextCursor ?? null,
      operations: Array.isArray(result.operations) ? result.operations : [],
    };
  }

  /** Every operation of the community the node stores, verified. */
  public async list(
    session: Session,
    communityId: string,
  ): Promise<CommunityOperation[]> {
    const operations: CommunityOperation[] = [];
    let cursor: string | undefined;

    for (;;) {
      const page = await this.page(session, communityId, cursor);

      operations.push(
        ...page.operations.flatMap(
          (document) =>
            CommunityOperationProof.open(document, communityId) ?? [],
        ),
      );

      // The node pages by an opaque cursor; a cursor that does not move ends
      // the read.
      if (page.nextCursor === null || page.nextCursor === cursor) {
        return operations;
      }

      cursor = page.nextCursor;
    }
  }
}
