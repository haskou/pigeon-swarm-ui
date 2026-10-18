import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type {
  IssuedNodeRegistrationCodeResource,
  NodeAccessInfoResource,
  NodeBlockApprovalResource,
  NodeBlockExceptionsResource,
  NodeBlockSourceResource,
  NodeBlockSourcesPageResource,
  NodeRegistrationCodeResource,
  NodeRegistrationCodesPageResource,
  NodeRegistrationModeResource,
  PendingNodeBlockEntriesPageResource,
  PendingNodeBlockEntriesResource,
  SignedNodeBlockListResource,
} from './resources/NodeAccessResources';

import {
  pagedPath,
  prefixedPagedPath,
} from '../../../../shared/infrastructure/http/pagedPath';
import { readAllPages } from '../../../../shared/infrastructure/http/readAllPages';

type Method = 'DELETE' | 'GET' | 'POST' | 'PUT';

type PendingArrayName = 'blockedIdentityIds' | 'blockedNodePeerIds';

const PENDING_NEXT_CURSOR: Record<
  PendingArrayName,
  'blockedIdentityIdsNextCursor' | 'blockedNodePeerIdsNextCursor'
> = {
  blockedIdentityIds: 'blockedIdentityIdsNextCursor',
  blockedNodePeerIds: 'blockedNodePeerIdsNextCursor',
};

/** The node owner's registration, blocking and block sharing routes. */
export class PigeonNodeAccessApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  private static sourcePath(ownerIdentityId: string): string {
    return `/node/block-sources/${encodeURIComponent(ownerIdentityId)}`;
  }

  private async signed<T>(
    session: Session,
    method: Method,
    path: string,
    body?: object,
  ): Promise<T> {
    return await this.http.request<T>(path, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: await this.signer.headers(session, method, path, body),
      method,
    });
  }

  public async getInfo(): Promise<NodeAccessInfoResource> {
    return await this.http.request<NodeAccessInfoResource>('/node');
  }

  public async updateRegistrationMode(
    mode: NodeRegistrationModeResource,
    session: Session,
  ): Promise<void> {
    await this.signed(session, 'PUT', '/node/registration', { mode });
  }

  public async createRegistrationCode(
    request: { expiresAt: number; maxUses: number },
    session: Session,
  ): Promise<IssuedNodeRegistrationCodeResource> {
    return await this.signed<IssuedNodeRegistrationCodeResource>(
      session,
      'POST',
      '/node/registration-codes',
      request,
    );
  }

  public async getRegistrationCodes(
    session: Session,
  ): Promise<NodeRegistrationCodeResource[]> {
    const path = '/node/registration-codes';
    const pages = await readAllPages<NodeRegistrationCodesPageResource>(
      async (cursor) =>
        await this.http.request<NodeRegistrationCodesPageResource>(
          pagedPath(path, cursor),
          {
            headers: await this.signer.headers(session, 'GET', path),
            method: 'GET',
          },
        ),
    );

    return pages.flatMap((page) => page.codes);
  }

  public async deleteRegistrationCode(
    codeId: string,
    session: Session,
  ): Promise<void> {
    await this.signed(
      session,
      'DELETE',
      `/node/registration-codes/${encodeURIComponent(codeId)}`,
    );
  }

  public async getBlockList(
    session: Session,
  ): Promise<SignedNodeBlockListResource | null> {
    const result = await this.signed<{
      blockList: SignedNodeBlockListResource | null;
    }>(session, 'GET', '/node/blocks');

    return result.blockList;
  }

  /**
   * The node authenticates the upload before reading its body: `X-Signature`
   * covers `X-Body-Hash`, the hex SHA-256 of the exact bytes sent, so each
   * call hashes and signs the serialized body afresh.
   */
  public async putBlockList(
    blockList: SignedNodeBlockListResource,
    session: Session,
  ): Promise<SignedNodeBlockListResource> {
    const path = '/node/blocks';
    const body = JSON.stringify(blockList);
    const bodyHash = SHA256Hash.from(body).toString();
    const result = await this.http.request<{
      blockList: SignedNodeBlockListResource;
    }>(path, {
      body,
      headers: {
        ...(await this.signer.headers(session, 'PUT', path, bodyHash)),
        'X-Body-Hash': bodyHash,
      },
      method: 'PUT',
    });

    return result.blockList;
  }

  public async getPublication(session: Session): Promise<boolean> {
    const result = await this.signed<{ published: boolean }>(
      session,
      'GET',
      '/node/blocks/publication',
    );

    return result.published;
  }

  public async putPublication(
    published: boolean,
    session: Session,
  ): Promise<boolean> {
    const result = await this.signed<{ published: boolean }>(
      session,
      'PUT',
      '/node/blocks/publication',
      { published },
    );

    return result.published;
  }

  public async getSources(
    session: Session,
  ): Promise<NodeBlockSourceResource[]> {
    const path = '/node/block-sources';
    const pages = await readAllPages<NodeBlockSourcesPageResource>(
      async (cursor) =>
        await this.http.request<NodeBlockSourcesPageResource>(
          pagedPath(path, cursor),
          {
            headers: await this.signer.headers(session, 'GET', path),
            method: 'GET',
          },
        ),
    );

    return pages.flatMap((page) => page.sources);
  }

  public async putSource(
    ownerIdentityId: string,
    source: { autoApply: boolean; origin: string },
    session: Session,
  ): Promise<NodeBlockSourceResource> {
    return await this.signed<NodeBlockSourceResource>(
      session,
      'PUT',
      PigeonNodeAccessApi.sourcePath(ownerIdentityId),
      source,
    );
  }

  public async deleteSource(
    ownerIdentityId: string,
    session: Session,
  ): Promise<NodeBlockSourceResource[]> {
    const result = await this.signed<{ sources: NodeBlockSourceResource[] }>(
      session,
      'DELETE',
      PigeonNodeAccessApi.sourcePath(ownerIdentityId),
    );

    return result.sources;
  }

  public async getPendingEntries(
    ownerIdentityId: string,
    session: Session,
  ): Promise<PendingNodeBlockEntriesResource> {
    const path = `${PigeonNodeAccessApi.sourcePath(ownerIdentityId)}/pending-entries`;
    const identityPages = await this.readPendingArray(
      path,
      session,
      'blockedIdentityIds',
    );
    const nodePeerPages = await this.readPendingArray(
      path,
      session,
      'blockedNodePeerIds',
    );
    const [head] = identityPages;

    return {
      blockedIdentityIds: identityPages.flatMap(
        (page) => page.blockedIdentityIds,
      ),
      blockedNodePeerIds: nodePeerPages.flatMap(
        (page) => page.blockedNodePeerIds,
      ),
      ownerIdentityId: head.ownerIdentityId,
      version: head.version,
    };
  }

  /**
   * Reads every page of one pending array. Each response also carries the
   * other array's first page, which this read does not keep.
   */
  private async readPendingArray(
    path: string,
    session: Session,
    name: PendingArrayName,
  ): Promise<PendingNodeBlockEntriesPageResource[]> {
    return await readAllPages<
      PendingNodeBlockEntriesPageResource & { nextCursor: string | null }
    >(async (cursor) => {
      const page = await this.http.request<PendingNodeBlockEntriesPageResource>(
        prefixedPagedPath(path, name, cursor),
        {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        },
      );

      return { ...page, nextCursor: page[PENDING_NEXT_CURSOR[name]] };
    });
  }

  public async postApproval(
    ownerIdentityId: string,
    approval: NodeBlockApprovalResource,
    session: Session,
  ): Promise<NodeBlockSourceResource> {
    return await this.signed<NodeBlockSourceResource>(
      session,
      'POST',
      `${PigeonNodeAccessApi.sourcePath(ownerIdentityId)}/approvals`,
      approval,
    );
  }

  public async getExceptions(
    session: Session,
  ): Promise<NodeBlockExceptionsResource> {
    return await this.signed<NodeBlockExceptionsResource>(
      session,
      'GET',
      '/node/block-exceptions',
    );
  }

  public async putExceptions(
    exceptions: NodeBlockExceptionsResource,
    session: Session,
  ): Promise<NodeBlockExceptionsResource> {
    return await this.signed<NodeBlockExceptionsResource>(
      session,
      'PUT',
      '/node/block-exceptions',
      exceptions,
    );
  }
}
