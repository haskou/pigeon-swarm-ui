import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CreatePollRequest } from './resources/CreatePollRequest';
import type { PollResource } from './resources/PollResource';
import type { PollScopeFields } from './resources/PollScopeFields';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { ScopeFrontierReader } from '../../../../shared/infrastructure/http/ScopeFrontierReader';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';

export class PigeonPollsApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly mutations: PublicMutationSigner,
    private readonly frontiers = new ScopeFrontierReader(http, signer),
  ) {}

  private async submit(
    session: Session,
    method: 'DELETE' | 'POST',
    path: string,
    scope: PollScopeFields,
    intent: {
      kind: 'delete' | 'put';
      payload: Record<string, unknown>;
    },
    fields: Record<string, unknown> = {},
  ): Promise<PollResource> {
    let response: PollResource | undefined;
    const frontier = await this.frontierOf(session, scope);

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            ...intent,
            frontier,
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

  private async frontierOf(
    session: Session,
    scope: PollScopeFields,
  ): Promise<string[]> {
    return 'conversationId' in scope
      ? await this.frontiers.conversation(session, scope.conversationId)
      : await this.frontiers.community(session, scope.communityId);
  }

  /**
   * Signs the channel message-timeline record that makes the poll appear in
   * its channel. Group polls travel inside the group's MLS mailbox instead.
   */
  private async channelTimelineMutation(
    session: Session,
    input: Extract<CreatePollRequest, { scopeType: 'community_channel' }>,
  ): Promise<SignedPublicMutation> {
    const authorId = this.mutations.authorOf(session);
    const id = [
      'community',
      input.communityId,
      input.channelId,
      input.pollId,
      authorId,
    ].join(':');

    return await this.mutations.sign(
      session,
      {
        frontier: await this.frontiers.community(session, input.communityId),
        kind: 'put',
        payload: {
          authorIdentityId: authorId,
          channelId: input.channelId,
          communityId: input.communityId,
          createdAt: input.createdAt,
          id,
          mentions: [],
          messageId: input.pollId,
          pollId: input.pollId,
          scopeType: 'community_channel',
          type: 'poll',
        },
        recordId: id,
        store: 'messages',
      },
      PublicMutationSigner.FIRST_POSITION,
    );
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
    const fields =
      input.scopeType === 'community_channel'
        ? {
            ...input,
            timelineMutation: await this.channelTimelineMutation(
              session,
              input,
            ),
          }
        : { ...input };

    return await this.submit(
      session,
      'POST',
      '/polls/',
      scope,
      { kind: 'put', payload },
      fields,
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
      scope,
      { kind: 'put', payload },
      { createdAt, optionIds },
    );
  }

  public async removeVote(
    session: Session,
    pollId: string,
    scope: PollScopeFields,
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
      scope,
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
      scope,
      { kind: 'put', payload },
      { createdAt },
    );
  }
}
