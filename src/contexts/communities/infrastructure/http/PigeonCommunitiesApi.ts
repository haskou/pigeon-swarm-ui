import { UUID } from '@haskou/value-objects';

import type {
  Community,
  CommunityChannel,
  CommunityDiscoveryResource,
  CommunityMessageMention,
  CommunityMembershipRequest,
  CommunityModerationLogPage,
  CommunityPermission,
  CommunityRoleResource,
  CommunityTextChannel,
  CommunityVisibility,
  CommunityVoiceChannel,
  CommunityChannelDraft,
  CommunityChannelDraftsResource,
  CommunityChannelMessagePinsResource,
  MessageResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { CachedRequest } from './CachedRequest';
import type { CachedRequestInvalidator } from './CachedRequestInvalidator';
/* eslint-disable @typescript-eslint/no-use-before-define */
import type { CommunityChannelMessageEditInput } from './CommunityChannelMessageEditInput';
import type { CommunityChannelMessageInput } from './CommunityChannelMessageInput';
import type { CommunityChannelMessageSearchResult } from './CommunityChannelMessageSearchResult';
import type { CommunityModerationLogBody } from './CommunityModerationLogBody';

import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';
import { DraftPayloadCipher } from '../../../messages/infrastructure/crypto/DraftPayloadCipher';
import { CommunityModerationLogSigner } from './CommunityModerationLogSigner';
import {
  deriveCommunityEntityId,
  deriveMembershipRequestId,
} from './deriveCommunityRecordId';

const startupReadCacheTtlMs = 1500;

export class PigeonCommunitiesApi {
  private readonly draftPayloads: DraftPayloadCipher;

  private readonly moderationLogs = new CommunityModerationLogSigner();

  private readonly mutations = new PublicMutationSigner();

  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
    private readonly cachedRequest: CachedRequest,
    draftPayloads?: DraftPayloadCipher,
    private readonly invalidateCachedRequest: CachedRequestInvalidator = () =>
      undefined,
  ) {
    this.draftPayloads = draftPayloads ?? new DraftPayloadCipher();
  }

  private membershipRequestRecord(
    request: Pick<
      CommunityMembershipRequest,
      | 'communityId'
      | 'creatorIdentityId'
      | 'id'
      | 'identityId'
      | 'status'
      | 'type'
    > & { createdAt: number | string; updatedAt: number | string },
  ): Record<string, unknown> {
    return {
      communityId: request.communityId,
      createdAt: Number(request.createdAt),
      creatorIdentityId: request.creatorIdentityId,
      id: request.id,
      identityId: request.identityId,
      scopeType: 'community_membership_request',
      status: request.status,
      type: request.type,
      updatedAt: Number(request.updatedAt),
    };
  }

  private async sendMembershipRequest<T>(
    session: Session,
    method: 'PATCH' | 'POST',
    path: string,
    record: Record<string, unknown>,
    fields: Record<string, unknown> = {},
    accepted?: { record: Record<string, unknown>; updatedAt: number },
  ): Promise<T> {
    let response: T | undefined;
    let acceptance: Record<string, unknown> = {};

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) => {
        const mutation = this.mutations.sign(
          session,
          {
            kind: 'put',
            payload: record,
            recordId: String(record.id),
            store: 'requests',
          },
          position,
        );

        if (accepted) {
          acceptance = {
            acceptedAt: accepted.updatedAt,
            acceptedMutation: this.mutations.sign(
              session,
              {
                kind: 'put',
                payload: accepted.record,
                recordId: String(record.id),
                store: 'requests',
              },
              {
                predecessor: this.mutations.digestOf(mutation),
                sequence: mutation.sequence + 1,
              },
            ),
          };
        }

        return mutation;
      },
      async (mutation) => {
        const body = { ...fields, ...acceptance, mutation };

        response = await this.http.request<T>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );

    return response as T;
  }

  private reactionIdentity(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Record<string, unknown> {
    const authorIdentityId = this.mutations.authorOf(session);

    return {
      authorIdentityId,
      channelId,
      communityId,
      emoji,
      id: [
        'community_channel',
        communityId,
        channelId,
        messageId,
        authorIdentityId,
        emoji,
      ].join(':'),
      messageId,
      scopeType: 'community_channel',
    };
  }

  private channelCreationBody(
    session: Session,
    communityId: string,
    name: string,
    type: 'text' | 'voice',
  ): { moderationLog: CommunityModerationLogBody; name: string } {
    const createdAt = Date.now();

    return {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'channel_created',
        communityId,
        createdAt,
        details: { name, type },
        target: {
          id: deriveCommunityEntityId(
            'channel',
            communityId,
            this.mutations.authorOf(session),
            createdAt,
          ),
          type: 'channel',
        },
      }),
      name,
    };
  }

  private async sendMutation(
    session: Session,
    method: 'DELETE' | 'POST',
    path: string,
    kind: 'delete' | 'put',
    store: string,
    payload: Record<string, unknown>,
    fields: Record<string, unknown> = {},
  ): Promise<void> {
    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          { kind, payload, recordId: String(payload.id), store },
          position,
        ),
      async (mutation) => {
        const body = { ...fields, mutation };

        await this.http.request(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );
  }

  private channelListCacheKey(session: Session, communityId: string): string {
    return `GET /communities/${encodeURIComponent(communityId)}/channels ${
      session.identity.id
    }`;
  }

  private communityDetailCacheKey(
    session: Session,
    communityId: string,
  ): string {
    return `GET /communities/${encodeURIComponent(communityId)} ${
      session.identity.id
    }`;
  }

  private invalidateCommunityDetailCache(
    session: Session,
    communityId: string,
  ): void {
    this.invalidateCachedRequest(
      this.communityDetailCacheKey(session, communityId),
    );
  }

  private invalidateChannelListCache(
    session: Session,
    communityId: string,
  ): void {
    this.invalidateCachedRequest(
      this.channelListCacheKey(session, communityId),
    );
  }

  private channelMessagePath(
    communityId: string,
    channelId: string,
    messageId: string,
  ): string {
    return `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(
      messageId,
    )}`;
  }

  private channelMessageRecordId(
    communityId: string,
    channelId: string,
    messageId: string,
    authorIdentityId: string,
  ): string {
    return [
      'community',
      communityId,
      channelId,
      messageId,
      authorIdentityId,
    ].join(':');
  }

  /** Stored record of a sent or edited channel message, minus its proof. */
  private channelMessageRecord(input: {
    authorIdentityId: string;
    channelId: string;
    communityId: string;
    createdAt: number;
    editedAt?: number;
    encryptedPayload?: string;
    mentions: CommunityMessageMention[];
    messageId: string;
    plaintextPayload?: string;
    replyToMessageId?: string;
  }): Record<string, unknown> {
    return {
      authorIdentityId: input.authorIdentityId,
      channelId: input.channelId,
      communityId: input.communityId,
      createdAt: input.createdAt,
      editedAt: input.editedAt,
      encryptedPayload: input.encryptedPayload,
      id: this.channelMessageRecordId(
        input.communityId,
        input.channelId,
        input.messageId,
        input.authorIdentityId,
      ),
      mentions: input.mentions,
      messageId: input.messageId,
      plaintextPayload: input.plaintextPayload,
      replyToMessageId: input.replyToMessageId,
      scopeType: 'community_channel',
      type: 'sent',
    };
  }

  private async sendChannelMessageMutation(
    session: Session,
    method: 'DELETE' | 'POST' | 'PUT',
    path: string,
    intent: { kind: 'delete' | 'put'; payload: Record<string, unknown> },
    fields: Record<string, unknown>,
  ): Promise<MessageResource> {
    let response: MessageResource | undefined;

    await submitPublicMutation(
      PublicMutationSigner.FIRST_POSITION,
      (position) =>
        this.mutations.sign(
          session,
          {
            ...intent,
            recordId: String(intent.payload.id),
            store: 'messages',
          },
          position,
        ),
      async (mutation) => {
        const body = { ...fields, mutation };

        response = await this.http.request<MessageResource>(path, {
          body: JSON.stringify(body),
          headers: await this.signer.headers(session, method, path, body),
          method,
        });
      },
    );

    return response as unknown as MessageResource;
  }

  public async list(session: Session): Promise<Community[]> {
    const path = '/communities/';
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<{ communities: Community[] }>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );

    return result.communities;
  }

  public async get(session: Session, communityId: string): Promise<Community> {
    const path = `/communities/${encodeURIComponent(communityId)}`;

    return await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<Community>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );
  }

  public async listModerationLogs(
    session: Session,
    communityId: string,
    input: { beforeLogId?: string; limit?: number } = {},
  ): Promise<CommunityModerationLogPage> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/moderation-logs`;
    const query = new URLSearchParams();

    if (input.limit) query.set('limit', String(input.limit));

    if (input.beforeLogId) query.set('beforeLogId', input.beforeLogId);

    return await this.http.request<CommunityModerationLogPage>(
      `${path}${query.size > 0 ? `?${query.toString()}` : ''}`,
      {
        headers: await this.signer.headers(session, 'GET', path),
        method: 'GET',
      },
    );
  }

  public async discover(
    session: Session,
    input: { networkId?: string; query?: string },
  ): Promise<CommunityDiscoveryResource[]> {
    const path = '/communities/discover';
    const query = new URLSearchParams();
    const body = {};

    if (input.query?.trim()) query.set('query', input.query.trim());

    if (input.networkId?.trim()) query.set('networkId', input.networkId.trim());

    const result = await this.http.request<{
      communities: CommunityDiscoveryResource[];
    }>(`${path}${query.size > 0 ? `?${query.toString()}` : ''}`, {
      headers: await this.signer.headers(session, 'GET', path, body),
      method: 'GET',
    });

    return result.communities;
  }

  public async create(
    session: Session,
    input: {
      autoJoinEnabled?: boolean | undefined;
      avatar?: string;
      banner?: string;
      description: string;
      discoverable?: boolean | undefined;
      name: string;
      networkId: string;
      visibility?: CommunityVisibility;
    },
  ): Promise<Community> {
    const path = '/communities/';
    const body = {
      ...(input.autoJoinEnabled !== undefined
        ? { autoJoinEnabled: input.autoJoinEnabled }
        : {}),
      ...(input.avatar ? { avatar: input.avatar } : {}),
      ...(input.banner ? { banner: input.banner } : {}),
      description: input.description,
      ...(input.discoverable !== undefined
        ? { discoverable: input.discoverable }
        : {}),
      name: input.name,
      networkId: input.networkId,
      ...(input.visibility ? { visibility: input.visibility } : {}),
    };

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async update(
    session: Session,
    communityId: string,
    input: {
      autoJoinEnabled?: boolean | undefined;
      avatar?: string;
      banner?: string;
      description?: string;
      discoverable?: boolean | undefined;
      name?: string;
    },
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(communityId)}`;
    const fields = {
      ...(input.autoJoinEnabled !== undefined
        ? { autoJoinEnabled: input.autoJoinEnabled }
        : {}),
      ...(input.avatar ? { avatar: input.avatar } : {}),
      ...(input.banner ? { banner: input.banner } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.discoverable !== undefined
        ? { discoverable: input.discoverable }
        : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
    };
    const body = {
      ...fields,
      moderationLog: this.moderationLogs.sign(session, {
        action: 'community_updated',
        communityId,
        createdAt: Date.now(),
        details: fields,
        target: { id: communityId, type: 'community' },
      }),
    };

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }

  public async inviteMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<CommunityMembershipRequest> {
    const path = `/communities/${encodeURIComponent(communityId)}/members`;
    const creatorIdentityId = this.mutations.authorOf(session);
    const createdAt = Date.now();
    const record = this.membershipRequestRecord({
      communityId,
      createdAt,
      creatorIdentityId,
      id: deriveMembershipRequestId(
        communityId,
        'invitation',
        creatorIdentityId,
        identityId,
        createdAt,
      ),
      identityId,
      status: 'pending',
      type: 'invitation',
      updatedAt: createdAt,
    });

    return await this.sendMembershipRequest<CommunityMembershipRequest>(
      session,
      'POST',
      path,
      record,
      {
        createdAt,
        identityId,
        moderationLog: this.moderationLogs.sign(session, {
          action: 'invitation_created',
          communityId,
          createdAt,
          details: { identityId },
          target: { id: record.id as string, type: 'membership_request' },
        }),
      },
    );
  }

  public async banMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(communityId)}/bans`;
    const body = {
      identityId,
      moderationLog: this.moderationLogs.sign(session, {
        action: 'member_banned',
        communityId,
        createdAt: Date.now(),
        details: {},
        target: { id: identityId, type: 'member' },
      }),
    };

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async unbanMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/bans/${encodeURIComponent(identityId)}`;
    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'member_unbanned',
        communityId,
        createdAt: Date.now(),
        details: {},
        target: { id: identityId, type: 'member' },
      }),
    };

    return await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
  }

  public async kickMember(
    session: Session,
    communityId: string,
    identityId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/members/${encodeURIComponent(identityId)}/kick`;

    return await this.http.request<Community>(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async createJoinRequest(
    session: Session,
    communityId: string,
  ): Promise<CommunityMembershipRequest> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/join-requests`;
    const identityId = this.mutations.authorOf(session);
    const createdAt = Date.now();
    const base = {
      communityId,
      createdAt,
      creatorIdentityId: identityId,
      id: deriveMembershipRequestId(
        communityId,
        'request',
        identityId,
        identityId,
        createdAt,
      ),
      identityId,
      type: 'request' as const,
    };
    const acceptedAt = createdAt + 1;

    // Auto-join communities require the requester's own acceptance proof; the
    // node ignores it for communities that review requests manually.
    return await this.sendMembershipRequest<CommunityMembershipRequest>(
      session,
      'POST',
      path,
      this.membershipRequestRecord({
        ...base,
        status: 'pending',
        updatedAt: createdAt,
      }),
      { createdAt },
      {
        record: this.membershipRequestRecord({
          ...base,
          status: 'accepted',
          updatedAt: acceptedAt,
        }),
        updatedAt: acceptedAt,
      },
    );
  }

  public async listMembershipRequests(
    session: Session,
  ): Promise<CommunityMembershipRequest[]> {
    const path = '/communities/membership-requests';
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<{
          requests: CommunityMembershipRequest[];
        }>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );

    return result.requests;
  }

  public async updateMembershipRequest(
    session: Session,
    requestId: string,
    status: Extract<
      CommunityMembershipRequest['status'],
      'accepted' | 'declined'
    >,
  ): Promise<CommunityMembershipRequest> {
    const path = `/communities/membership-requests/${encodeURIComponent(
      requestId,
    )}`;
    const current = (await this.listMembershipRequests(session)).find(
      (request) => request.id === requestId,
    );

    if (!current) throw new Error('Membership request not found.');

    const updatedAt = Math.max(Date.now(), Number(current.updatedAt) + 1);

    return await this.sendMembershipRequest<CommunityMembershipRequest>(
      session,
      'PATCH',
      path,
      this.membershipRequestRecord({ ...current, status, updatedAt }),
      {
        moderationLog: this.moderationLogs.sign(session, {
          action:
            status === 'accepted'
              ? 'membership_request_accepted'
              : 'membership_request_declined',
          communityId: current.communityId,
          createdAt: Date.now(),
          details: { identityId: current.identityId, type: current.type },
          target: { id: requestId, type: 'membership_request' },
        }),
        status,
        updatedAt,
      },
    );
  }

  public async leave(
    session: Session,
    communityId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(communityId)}/members/me`;

    return await this.http.request<Community>(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async listMembers(
    session: Session,
    communityId: string,
  ): Promise<string[]> {
    const path = `/communities/${encodeURIComponent(communityId)}/members`;
    const result = await this.http.request<{ memberIds: string[] }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return result.memberIds;
  }

  public async listRoles(
    session: Session,
    communityId: string,
  ): Promise<CommunityRoleResource[]> {
    const path = `/communities/${encodeURIComponent(communityId)}/roles`;
    const result = await this.http.request<{
      roles: CommunityRoleResource[];
    }>(path, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return result.roles;
  }

  public async createRole(
    session: Session,
    communityId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    const path = `/communities/${encodeURIComponent(communityId)}/roles`;
    const createdAt = Date.now();
    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'role_created',
        communityId,
        createdAt,
        details: { name: input.name, permissions: input.permissions },
        target: {
          id: deriveCommunityEntityId(
            'role',
            communityId,
            this.mutations.authorOf(session),
            createdAt,
          ),
          type: 'role',
        },
      }),
      name: input.name,
      permissions: input.permissions,
    };

    return await this.http.request<CommunityRoleResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });
  }

  public async updateRole(
    session: Session,
    communityId: string,
    roleId: string,
    input: { name: string; permissions: CommunityPermission[] },
  ): Promise<CommunityRoleResource> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/roles/${encodeURIComponent(roleId)}`;
    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'role_updated',
        communityId,
        createdAt: Date.now(),
        details: { name: input.name, permissions: input.permissions },
        target: { id: roleId, type: 'role' },
      }),
      name: input.name,
      permissions: input.permissions,
    };

    return await this.http.request<CommunityRoleResource>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });
  }

  public async deleteRole(
    session: Session,
    communityId: string,
    roleId: string,
  ): Promise<void> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/roles/${encodeURIComponent(roleId)}`;

    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'role_deleted',
        communityId,
        createdAt: Date.now(),
        details: {},
        target: { id: roleId, type: 'role' },
      }),
    };

    await this.http.request(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });
  }

  public async assignMemberRoles(
    session: Session,
    communityId: string,
    identityId: string,
    roleIds: string[],
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/members/${encodeURIComponent(identityId)}/roles`;
    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'member_roles_updated',
        communityId,
        createdAt: Date.now(),
        details: { roleIds },
        target: { id: identityId, type: 'member' },
      }),
      roleIds,
    };

    const community = await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });

    this.invalidateCommunityDetailCache(session, communityId);

    return community;
  }

  public async createTextChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityTextChannel> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/text`;
    const body = this.channelCreationBody(session, communityId, name, 'text');

    const channel = await this.http.request<CommunityTextChannel>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });

    this.invalidateChannelListCache(session, communityId);

    return channel;
  }

  public async createVoiceChannel(
    session: Session,
    communityId: string,
    name: string,
  ): Promise<CommunityVoiceChannel> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/voice`;
    const body = this.channelCreationBody(session, communityId, name, 'voice');

    const channel = await this.http.request<CommunityVoiceChannel>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'POST', path, body),
      method: 'POST',
    });

    this.invalidateChannelListCache(session, communityId);

    return channel;
  }

  public async listChannels(
    session: Session,
    communityId: string,
  ): Promise<CommunityChannel[]> {
    const path = `/communities/${encodeURIComponent(communityId)}/channels`;
    const result = await this.cachedRequest(
      this.channelListCacheKey(session, communityId),
      async () =>
        await this.http.request<{
          channels: CommunityChannel[];
        }>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );

    return result.channels;
  }

  public async renameChannel(
    session: Session,
    communityId: string,
    channelId: string,
    name: string,
  ): Promise<CommunityChannel> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}`;
    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'channel_renamed',
        communityId,
        createdAt: Date.now(),
        details: { name },
        target: { id: channelId, type: 'channel' },
      }),
      name,
    };

    const channel = await this.http.request<CommunityChannel>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });

    this.invalidateChannelListCache(session, communityId);

    return channel;
  }

  public async deleteChannel(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<Community> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}`;
    const channels = await this.listChannels(session, communityId);
    const channelType = channels.find(
      (channel) => channel.id === channelId,
    )?.type;

    if (!channelType) throw new Error('Community channel not found.');

    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'channel_deleted',
        communityId,
        createdAt: Date.now(),
        details: { type: channelType },
        target: { id: channelId, type: 'channel' },
      }),
    };

    const community = await this.http.request<Community>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'DELETE', path, body),
      method: 'DELETE',
    });

    this.invalidateChannelListCache(session, communityId);

    return community;
  }

  public async updateChannelPermissions(
    session: Session,
    communityId: string,
    channelId: string,
    visibleRoleIds: string[],
  ): Promise<CommunityChannel> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/permissions`;
    const body = {
      moderationLog: this.moderationLogs.sign(session, {
        action: 'channel_permissions_updated',
        communityId,
        createdAt: Date.now(),
        details: { visibleRoleIds },
        target: { id: channelId, type: 'channel' },
      }),
      visibleRoleIds,
    };

    const channel = await this.http.request<CommunityChannel>(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PATCH', path, body),
      method: 'PATCH',
    });

    this.invalidateChannelListCache(session, communityId);

    return channel;
  }

  public async createChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    input: CommunityChannelMessageInput,
  ): Promise<MessageResource> {
    const createdAt = input.timestamp ?? Date.now();
    const id =
      input.id ??
      `${communityId}:${channelId}:${createdAt}:${UUID.generate().toString()}`;
    const mentions = input.mentions ?? [];
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages`;
    const payload = this.channelMessageRecord({
      authorIdentityId: this.mutations.authorOf(session),
      channelId,
      communityId,
      createdAt,
      encryptedPayload: input.encryptedPayload,
      mentions,
      messageId: id,
      plaintextPayload: input.plaintextPayload,
      replyToMessageId: input.replyToMessageId,
    });

    return await this.sendChannelMessageMutation(
      session,
      'POST',
      path,
      { kind: 'put', payload },
      {
        createdAt,
        encryptedPayload: input.encryptedPayload,
        id,
        mentions,
        plaintextPayload: input.plaintextPayload,
        replyToMessageId: input.replyToMessageId,
      },
    );
  }

  public async listChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    options: { beforeMessageId?: string; limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    const query = new URLSearchParams({
      limit: String(options.limit ?? 50),
    });

    if (options.beforeMessageId) {
      query.set('beforeMessageId', options.beforeMessageId);
    }

    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages?${query.toString()}`;
    const result = await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<{
          messages: MessageResource[];
          nextBeforeMessageId?: string;
        }>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );

    return {
      messages: result.messages,
      nextBeforeMessageId: result.nextBeforeMessageId ?? null,
    };
  }

  public async listChannelMessageThread(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    options: { limit?: number } = {},
  ): Promise<{
    messages: MessageResource[];
    nextBeforeMessageId?: null | string;
  }> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(
      messageId,
    )}/thread`;
    const query = new URLSearchParams({
      limit: String(options.limit ?? 50),
    });
    const result = await this.http.request<{
      messages?: MessageResource[];
      nextBeforeMessageId?: null | string;
    }>(`${path}?${query.toString()}`, {
      headers: await this.signer.headers(session, 'GET', path),
      method: 'GET',
    });

    return {
      messages: result.messages ?? [],
      nextBeforeMessageId: result.nextBeforeMessageId ?? null,
    };
  }

  public async listChannelMessagePins(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<CommunityChannelMessagePinsResource> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/pins`;

    return await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () =>
        await this.http.request<CommunityChannelMessagePinsResource>(path, {
          headers: await this.signer.headers(session, 'GET', path),
          method: 'GET',
        }),
      { ttlMs: startupReadCacheTtlMs },
    );
  }

  public async pinChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    const path = communityChannelMessagePinPath(
      communityId,
      channelId,
      messageId,
    );
    const createdAt = Date.now();
    const payload = {
      channelId,
      communityId,
      createdAt,
      id: `community:${communityId}:${channelId}:${messageId}`,
      messageId,
      pinnedByIdentityId: this.mutations.authorOf(session),
      scopeType: 'community_channel',
    };

    await this.sendMutation(session, 'POST', path, 'put', 'pins', payload, {
      createdAt,
    });
  }

  public async unpinChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    const path = communityChannelMessagePinPath(
      communityId,
      channelId,
      messageId,
    );
    const payload = {
      channelId,
      communityId,
      id: `community:${communityId}:${channelId}:${messageId}`,
      messageId,
      pinnedByIdentityId: this.mutations.authorOf(session),
      removed: true,
      scopeType: 'community_channel',
    };

    await this.sendMutation(session, 'DELETE', path, 'delete', 'pins', payload);
  }

  public async listDrafts(session: Session): Promise<CommunityChannelDraft[]> {
    const path = '/communities/me/drafts';

    return await this.cachedRequest(
      `GET ${path} ${session.identity.id}`,
      async () => {
        const result = await this.http.request<CommunityChannelDraftsResource>(
          path,
          {
            headers: await this.signer.headers(session, 'GET', path),
            method: 'GET',
          },
        );

        return await Promise.all(
          result.drafts.map(async (draft) => ({
            ...draft,
            content: await this.draftPayloads.decrypt(
              session,
              draft.encryptedPayload,
            ),
          })),
        );
      },
      { ttlMs: startupReadCacheTtlMs },
    );
  }

  public async saveChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
    content: string,
    updatedAt = Date.now(),
  ): Promise<CommunityChannelDraft> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/draft`;
    const encryptedPayload = this.draftPayloads.encrypt(session, content);
    const body = { encryptedPayload, updatedAt };
    const draft = await this.http.request<
      Omit<CommunityChannelDraft, 'content'>
    >(path, {
      body: JSON.stringify(body),
      headers: await this.signer.headers(session, 'PUT', path, body),
      method: 'PUT',
    });

    return { ...draft, content };
  }

  public async deleteChannelDraft(
    session: Session,
    communityId: string,
    channelId: string,
  ): Promise<void> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/draft`;

    await this.http.request(path, {
      headers: await this.signer.headers(session, 'DELETE', path),
      method: 'DELETE',
    });
  }

  public async searchChannelMessages(
    session: Session,
    communityId: string,
    channelId: string,
    input: { limit?: number; query: string },
  ): Promise<CommunityChannelMessageSearchResult> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/channels/${encodeURIComponent(channelId)}/messages/search`;
    const query = new URLSearchParams({
      limit: String(input.limit ?? 20),
      query: input.query,
    });
    const result = await this.http.request<CommunityChannelMessageSearchResult>(
      `${path}?${query.toString()}`,
      {
        headers: await this.signer.headers(session, 'GET', path),
        method: 'GET',
      },
    );

    return {
      ...result,
      channelId: result.channelId ?? channelId,
    };
  }

  public async searchCommunityMessages(
    session: Session,
    communityId: string,
    input: { limit?: number; query: string },
  ): Promise<CommunityChannelMessageSearchResult> {
    const path = `/communities/${encodeURIComponent(
      communityId,
    )}/messages/search`;
    const query = new URLSearchParams({
      limit: String(input.limit ?? 20),
      query: input.query,
    });

    return await this.http.request<CommunityChannelMessageSearchResult>(
      `${path}?${query.toString()}`,
      {
        headers: await this.signer.headers(session, 'GET', path),
        method: 'GET',
      },
    );
  }

  public async deleteChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    authorIdentityId: string,
  ): Promise<void> {
    const path = this.channelMessagePath(communityId, channelId, messageId);
    const payload = {
      authorIdentityId,
      channelId,
      communityId,
      id: this.channelMessageRecordId(
        communityId,
        channelId,
        messageId,
        authorIdentityId,
      ),
      messageId,
      removed: true,
      scopeType: 'community_channel',
    };

    const createdAt = Date.now();

    await this.sendChannelMessageMutation(
      session,
      'DELETE',
      path,
      { kind: 'delete', payload },
      {
        moderationLog: this.moderationLogs.sign(session, {
          action: 'message_deleted',
          communityId,
          createdAt,
          details: { channelId, targetMessageAuthorId: authorIdentityId },
          target: { id: messageId, type: 'message' },
        }),
      },
    );
  }

  public async editChannelMessage(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    input: CommunityChannelMessageEditInput,
  ): Promise<MessageResource> {
    const editedAt = input.timestamp ?? Date.now();
    const mentions = input.mentions ?? [];
    const path = this.channelMessagePath(communityId, channelId, messageId);
    const payload = this.channelMessageRecord({
      authorIdentityId: this.mutations.authorOf(session),
      channelId,
      communityId,
      createdAt: input.original.createdAt,
      editedAt,
      encryptedPayload: input.encryptedPayload,
      mentions,
      messageId,
      plaintextPayload: input.plaintextPayload,
      replyToMessageId: input.original.replyToMessageId,
    });

    return await this.sendChannelMessageMutation(
      session,
      'PUT',
      path,
      { kind: 'put', payload },
      {
        createdAt: editedAt,
        encryptedPayload: input.encryptedPayload,
        mentions,
        plaintextPayload: input.plaintextPayload,
      },
    );
  }

  public async addChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    const createdAt = Date.now();

    await this.sendMutation(
      session,
      'POST',
      communityChannelMessageReactionsPath(communityId, channelId, messageId),
      'put',
      'reactions',
      {
        ...this.reactionIdentity(
          session,
          communityId,
          channelId,
          messageId,
          emoji,
        ),
        createdAt,
      },
      { createdAt, emoji },
    );
  }

  public async removeChannelMessageReaction(
    session: Session,
    communityId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    await this.sendMutation(
      session,
      'DELETE',
      communityChannelMessageReactionsPath(communityId, channelId, messageId),
      'delete',
      'reactions',
      {
        ...this.reactionIdentity(
          session,
          communityId,
          channelId,
          messageId,
          emoji,
        ),
        removed: true,
      },
      { emoji },
    );
  }
}

function communityChannelMessagePinPath(
  communityId: string,
  channelId: string,
  messageId: string,
): string {
  return `/communities/${encodeURIComponent(
    communityId,
  )}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(
    messageId,
  )}/pin`;
}

function communityChannelMessageReactionsPath(
  communityId: string,
  channelId: string,
  messageId: string,
): string {
  return `/communities/${encodeURIComponent(
    communityId,
  )}/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(
    messageId,
  )}/reactions`;
}
