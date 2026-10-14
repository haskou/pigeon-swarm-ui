import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CommunityOperation } from '../../domain/operations/CommunityOperation';

import { CommunityOperationProof } from './CommunityOperationProof';

/** Operations the node returns per page, its maximum. */
const PAGE_SIZE = 500;

/**
 * Reads the signed operations of one community from the node, the history
 * members replay roles from. Keeps only the operations that prove themselves:
 * a node can withhold operations, never forge or alter one.
 */
export class PigeonCommunityOperationsApi {
  /** The digest of the last operation of `page`, where the next one starts. */
  private static cursorOf(page: readonly unknown[]): string | undefined {
    const last: unknown = (
      page[page.length - 1] as { id?: unknown } | undefined
    )?.id;

    return typeof last === 'string' ? last.split(':op:')[1] : undefined;
  }

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  /** The documents the node serves after `after`, unverified. */
  private async page(
    session: Session,
    communityId: string,
    after: string | undefined,
  ): Promise<unknown[]> {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });

    if (after !== undefined) params.set('after', after);

    const path = `/communities/${encodeURIComponent(communityId)}/operations?${params.toString()}`;
    const result = await this.http.request<{ operations?: unknown[] }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return Array.isArray(result.operations) ? result.operations : [];
  }

  /** Every operation of the community the node stores, verified. */
  public async list(
    session: Session,
    communityId: string,
  ): Promise<CommunityOperation[]> {
    const operations: CommunityOperation[] = [];
    let after: string | undefined;

    for (;;) {
      const page = await this.page(session, communityId, after);

      operations.push(
        ...page.flatMap(
          (document) =>
            CommunityOperationProof.open(document, communityId) ?? [],
        ),
      );

      const cursor = PigeonCommunityOperationsApi.cursorOf(page);

      // The node pages by digest; a cursor that does not move ends the read.
      if (
        page.length < PAGE_SIZE ||
        cursor === undefined ||
        (after !== undefined && cursor <= after)
      ) {
        return operations;
      }

      after = cursor;
    }
  }
}
