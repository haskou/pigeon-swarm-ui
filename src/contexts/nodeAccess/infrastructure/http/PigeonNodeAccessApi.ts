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
  NodeRegistrationCodeResource,
  NodeRegistrationModeResource,
  PendingNodeBlockEntriesResource,
  SignedNodeBlockListResource,
} from './resources/NodeAccessResources';

type Method = 'DELETE' | 'GET' | 'POST' | 'PUT';

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
    return await this.http.request<NodeAccessInfoResource>('/node/');
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
    const result = await this.signed<{ codes: NodeRegistrationCodeResource[] }>(
      session,
      'GET',
      '/node/registration-codes',
    );

    return result.codes;
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
    const result = await this.signed<{ sources: NodeBlockSourceResource[] }>(
      session,
      'GET',
      '/node/block-sources',
    );

    return result.sources;
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
    return await this.signed<PendingNodeBlockEntriesResource>(
      session,
      'GET',
      `${PigeonNodeAccessApi.sourcePath(ownerIdentityId)}/pending`,
    );
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
