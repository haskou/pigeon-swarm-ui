import { CommitmentId } from '@haskou/pigeon-swarm-crypto';

import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { MlsRecordInput } from './MlsRecordInput';
import type { MlsRecordKind } from './resources/MlsRecordKind';
import type { MlsRecordResource } from './resources/MlsRecordResource';
import type { MlsRecordsResource } from './resources/MlsRecordsResource';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { ScopeFrontierReader } from '../../../../shared/infrastructure/http/ScopeFrontierReader';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';

const recordsPath = (communityId: string): string =>
  `/communities/${encodeURIComponent(communityId)}/mls/records`;

/** Longest wait for one record request, so a stalled one frees its queue. */
const MLS_REQUEST_TIMEOUT_MS = 15_000;

/** Publishes and reads the opaque MLS records the node transports. */
export class PigeonMlsRecordsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly mutations: PublicMutationSigner,
    private readonly frontiers = new ScopeFrontierReader(http, signer),
    private readonly requestTimeoutMs = MLS_REQUEST_TIMEOUT_MS,
  ) {}

  /** A fresh deadline per request, so a stalled answer fails, not hangs. */
  private deadline(): AbortSignal {
    return AbortSignal.timeout(this.requestTimeoutMs);
  }

  public async list(
    session: Session,
    communityId: string,
    query: { afterEpoch?: number; groupId: string; kind?: MlsRecordKind },
  ): Promise<MlsRecordResource[]> {
    const params = new URLSearchParams({ groupId: query.groupId });

    if (query.kind) params.set('kind', query.kind);

    if (query.afterEpoch !== undefined)
      params.set('afterEpoch', String(query.afterEpoch));

    const path = `${recordsPath(communityId)}?${params.toString()}`;
    const result = await this.http.request<MlsRecordsResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
      signal: this.deadline(),
    });

    return result.records ?? [];
  }

  public async publish(
    session: Session,
    communityId: string,
    input: MlsRecordInput,
  ): Promise<MlsRecordResource> {
    const path = recordsPath(communityId);
    const recordId = CommitmentId.mlsRecord(input);
    const createdAt = Date.now();
    const document = {
      authorIdentityId: this.mutations.authorOf(session),
      communityId,
      createdAt,
      ...(input.epoch !== undefined && { epoch: input.epoch }),
      groupId: input.groupId,
      id: `community:${communityId}:mls:${recordId}`,
      kind: input.kind,
      payload: input.payload,
      ...(input.recipientIdentityId && {
        recipientIdentityId: input.recipientIdentityId,
      }),
      scopeType: 'community_mls',
    };
    let stored: MlsRecordResource | undefined;
    const frontier = await this.frontiers.community(session, communityId, {
      signal: this.deadline(),
    });

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            frontier,
            kind: 'put',
            payload: document,
            recordId: document.id,
            store: 'mlsRecords',
          },
          position,
        ),
      async (mutation) => {
        const body = { ...input, createdAt, mutation };

        stored = await this.http.request<MlsRecordResource>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, 'POST', path, body),
          method: 'POST',
          signal: this.deadline(),
        });
      },
    );

    return stored as MlsRecordResource;
  }
}
