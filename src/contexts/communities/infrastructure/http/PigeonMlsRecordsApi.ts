import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { MlsRecordInput } from './MlsRecordInput';
import type { MlsRecordKind } from './resources/MlsRecordKind';
import type { MlsRecordResource } from './resources/MlsRecordResource';
import type { MlsRecordsResource } from './resources/MlsRecordsResource';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { deriveMlsRecordId } from './deriveMlsRecordId';

const recordsPath = (communityId: string): string =>
  `/communities/${encodeURIComponent(communityId)}/mls/records`;

/** Publishes and reads the opaque MLS records the node transports. */
export class PigeonMlsRecordsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly mutations: PublicMutationSigner,
  ) {}

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
    });

    return result.records ?? [];
  }

  public async publish(
    session: Session,
    communityId: string,
    input: MlsRecordInput,
  ): Promise<MlsRecordResource> {
    const path = recordsPath(communityId);
    const recordId = deriveMlsRecordId(input);
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

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
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
        });
      },
    );

    return stored as MlsRecordResource;
  }
}
