import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';

export type ContentReplicationContext =
  | 'ipfs_private_upload'
  | 'ipfs_public_upload';

/**
 * Registers uploaded content for replication with an owner-signed record.
 * The node replicates a CID only after this registration, which in turn
 * requires the identity to be published.
 */
export class PigeonContentReplicationClient {
  private static readonly MAX_SIZE_BYTES = 52_428_800;

  public constructor(
    private readonly http: Pick<HttpJsonClient, 'request'>,
    private readonly signer: Pick<RequestSigner, 'headers'>,
    private readonly mutations: PublicMutationSigner,
  ) {}

  private async send(
    session: Session,
    method: 'DELETE' | 'PUT',
    cid: string,
    networkId: string,
    payload: Record<string, unknown>,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const path = `/ipfs/replication/${encodeURIComponent(cid)}`;

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            kind: method === 'PUT' ? 'put' : 'delete',
            payload,
            recordId: String(payload.id),
            store: 'contentReplication',
          },
          position,
        ),
      async (mutation) => {
        const body = { ...fields, mutation, networkId };

        await this.http.request<void>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );
  }

  private base(session: Session, cid: string, networkId: string) {
    return {
      cid,
      id: `content:${networkId}:${cid}`,
      networkId,
      ownerIdentityId: this.mutations.authorOf(session),
      scopeType: 'content_replication',
    };
  }

  public async register(
    session: Session,
    input: {
      cid: string;
      context: ContentReplicationContext;
      networkId: string;
      sizeBytes: number;
    },
  ): Promise<void> {
    const sizeBytes = Math.min(
      Math.max(1, Math.trunc(input.sizeBytes)),
      PigeonContentReplicationClient.MAX_SIZE_BYTES,
    );

    await this.send(
      session,
      'PUT',
      input.cid,
      input.networkId,
      {
        ...this.base(session, input.cid, input.networkId),
        context: input.context,
        sizeBytes,
      },
      { context: input.context, sizeBytes },
    );
  }

  public async withdraw(
    session: Session,
    cid: string,
    networkId: string,
  ): Promise<void> {
    await this.send(
      session,
      'DELETE',
      cid,
      networkId,
      { ...this.base(session, cid, networkId), removed: true },
      {},
    );
  }
}
