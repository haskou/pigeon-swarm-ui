import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { CreatePollRequest } from './resources/CreatePollRequest';
import type { PollResource } from './resources/PollResource';
import type { PollScopeFields } from './resources/PollScopeFields';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';

export class PigeonPollsApi {
  private readonly mutations = new PublicMutationSigner();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  private async submit(
    session: Session,
    method: 'DELETE' | 'POST',
    path: string,
    intent: {
      kind: 'delete' | 'put';
      payload: Record<string, unknown>;
    },
    fields: Record<string, unknown> = {},
  ): Promise<PollResource> {
    let response: PollResource | undefined;

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            ...intent,
            recordId: String(intent.payload.id),
            store: 'polls',
          },
          position,
        ),
      async (mutation) => {
        const body = { ...fields, mutation };

        response = await this.http.request<PollResource>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );

    return response as PollResource;
  }

  public async create(
    session: Session,
    input: CreatePollRequest,
  ): Promise<PollResource> {
    const scope =
      input.scopeType === 'community_channel'
        ? { channelId: input.channelId, communityId: input.communityId }
        : { conversationId: input.conversationId };
    const payload = {
      allowsMultipleVotes: input.allowsMultipleVotes,
      createdAt: input.createdAt,
      creatorIdentityId: this.mutations.authorOf(session),
      ...(input.expiresAt === null || input.expiresAt === undefined
        ? {}
        : { expiresAt: input.expiresAt }),
      id: input.pollId,
      options: input.options.map(({ id, text }) => ({ id, text })),
      question: input.question,
      scopeType: 'poll',
      ...scope,
    };

    return await this.submit(
      session,
      'POST',
      '/polls/',
      { kind: 'put', payload },
      input,
    );
  }

  public async get(session: Session, pollId: string): Promise<PollResource> {
    const path = `/polls/${encodeURIComponent(pollId)}`;

    return await this.http.request<PollResource>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });
  }

  public async vote(
    session: Session,
    pollId: string,
    scope: PollScopeFields,
    optionIds: string[],
    createdAt: number,
  ): Promise<PollResource> {
    const voterIdentityId = this.mutations.authorOf(session);
    const payload = {
      ...scope,
      createdAt,
      id: `poll-vote:${pollId}:${voterIdentityId}`,
      optionIds,
      pollId,
      scopeType: 'poll_vote',
      voterIdentityId,
    };

    return await this.submit(
      session,
      'POST',
      `/polls/${encodeURIComponent(pollId)}/votes`,
      { kind: 'put', payload },
      { createdAt, optionIds },
    );
  }

  public async removeVote(
    session: Session,
    pollId: string,
  ): Promise<PollResource> {
    const voterIdentityId = this.mutations.authorOf(session);
    const payload = {
      id: `poll-vote:${pollId}:${voterIdentityId}`,
      pollId,
      removed: true,
      scopeType: 'poll_vote',
      voterIdentityId,
    };

    return await this.submit(
      session,
      'DELETE',
      `/polls/${encodeURIComponent(pollId)}/votes/me`,
      { kind: 'delete', payload },
    );
  }

  public async close(
    session: Session,
    pollId: string,
    scope: PollScopeFields,
    createdAt: number,
  ): Promise<PollResource> {
    const payload = {
      ...scope,
      closedByIdentityId: this.mutations.authorOf(session),
      createdAt,
      id: `poll-close:${pollId}`,
      pollId,
      scopeType: 'poll_close',
    };

    return await this.submit(
      session,
      'POST',
      `/polls/${encodeURIComponent(pollId)}/close`,
      { kind: 'put', payload },
      { createdAt },
    );
  }
}
