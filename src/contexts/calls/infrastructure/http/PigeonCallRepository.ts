import type { Timestamp } from '@haskou/value-objects';

import type { Call } from '../../domain/Call';
import type { CallMediaConnection } from '../../domain/entities/CallMediaConnection';
import type { CallRepository } from '../../domain/repositories/CallRepository';
import type { CallId } from '../../domain/value-objects/CallId';
import type { CallIdentityId } from '../../domain/value-objects/CallIdentityId';
import type { CallScope } from '../../domain/value-objects/CallScope';

import { CallAccessContexts } from './CallAccessContexts';
import { CallMapper } from './CallMapper';
import { PigeonCallsApi } from './PigeonCallsApi';

export class PigeonCallRepository implements CallRepository {
  public constructor(
    private readonly api: PigeonCallsApi,
    private readonly contexts: CallAccessContexts,
    private readonly mapper: CallMapper,
  ) {}

  public async create(
    scope: CallScope,
    actorIdentityId: CallIdentityId,
    startedAt: Timestamp,
  ): Promise<Call> {
    const session = this.contexts.find(actorIdentityId);
    const primitives = scope.toPrimitives();
    const resource =
      primitives.type === 'community_channel'
        ? await this.api.startCommunityChannel(
            session,
            primitives.communityId,
            primitives.channelId,
            startedAt.valueOf(),
          )
        : await this.api.startConversation(
            session,
            primitives.conversationId,
            startedAt.valueOf(),
          );

    return this.mapper.fromResource(resource);
  }

  public async end(
    call: Call,
    actorIdentityId: CallIdentityId,
    endedAt: Timestamp,
  ): Promise<void> {
    await this.api.end(
      this.contexts.find(actorIdentityId),
      call.getId().toString(),
      endedAt.valueOf(),
    );
  }

  public async find(
    callId: CallId,
    actorIdentityId: CallIdentityId,
  ): Promise<Call> {
    const resource = await this.api.get(
      this.contexts.find(actorIdentityId),
      callId.toString(),
    );

    return this.mapper.fromResource(resource);
  }

  public async heartbeat(
    callId: CallId,
    actorIdentityId: CallIdentityId,
    mediaConnections: CallMediaConnection[],
  ): Promise<void> {
    await this.api.heartbeat(
      this.contexts.find(actorIdentityId),
      callId.toString(),
      mediaConnections.map((connection) => connection.toPrimitives()),
    );
  }

  public async join(
    call: Call,
    actorIdentityId: CallIdentityId,
    joinedAt: Timestamp,
  ): Promise<Call> {
    const resource = await this.api.join(
      this.contexts.find(actorIdentityId),
      call.getId().toString(),
      joinedAt.valueOf(),
    );

    return this.mapper.fromResource(resource);
  }

  public async leave(
    call: Call,
    actorIdentityId: CallIdentityId,
    leftAt: Timestamp,
    declined: boolean,
  ): Promise<void> {
    await this.api.leave(
      this.contexts.find(actorIdentityId),
      call.getId().toString(),
      leftAt.valueOf(),
      declined,
    );
  }

  public async search(actorIdentityId: CallIdentityId): Promise<Call[]> {
    const resources = await this.api.list(this.contexts.find(actorIdentityId));

    return resources.map((resource) => this.mapper.fromResource(resource));
  }
}
