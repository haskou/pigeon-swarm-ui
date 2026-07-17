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
  ): Promise<Call> {
    const session = this.contexts.find(actorIdentityId);
    const primitives = scope.toPrimitives();
    const resource =
      primitives.type === 'community_channel'
        ? await this.api.startCommunityChannel(
            session,
            primitives.communityId,
            primitives.channelId,
          )
        : await this.api.startConversation(session, primitives.conversationId);

    return this.mapper.fromResource(resource);
  }

  public async end(call: Call, actorIdentityId: CallIdentityId): Promise<void> {
    await this.api.end(
      this.contexts.find(actorIdentityId),
      call.getId().toString(),
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
    call: Call,
    actorIdentityId: CallIdentityId,
    mediaConnections: CallMediaConnection[],
  ): Promise<Call> {
    const resource = await this.api.heartbeat(
      this.contexts.find(actorIdentityId),
      call.getId().toString(),
      mediaConnections.map((connection) => connection.toPrimitives()),
    );

    return this.mapper.fromResource(resource);
  }

  public async join(
    call: Call,
    actorIdentityId: CallIdentityId,
  ): Promise<Call> {
    const resource = await this.api.join(
      this.contexts.find(actorIdentityId),
      call.getId().toString(),
    );

    return this.mapper.fromResource(resource);
  }

  public async leave(
    call: Call,
    actorIdentityId: CallIdentityId,
  ): Promise<void> {
    await this.api.leave(
      this.contexts.find(actorIdentityId),
      call.getId().toString(),
    );
  }

  public async search(actorIdentityId: CallIdentityId): Promise<Call[]> {
    const resources = await this.api.list(this.contexts.find(actorIdentityId));

    return resources.map((resource) => this.mapper.fromResource(resource));
  }
}
