import { type PrimitiveOf } from '@haskou/value-objects';

import type { Poll } from '../../domain/Poll';
import type { CreatePollRequest } from './resources/CreatePollRequest';
import type { PollResource } from './resources/PollResource';
import type { PollScopeResource } from './resources/PollScopeResource';

import { Poll as PollAggregate } from '../../domain/Poll';
import { PollProjectionNotFoundError } from './errors/PollProjectionNotFoundError';

export class PollMapper {
  private readonly projections = new WeakMap<Poll, PollResource>();

  private scopeFromResource(
    scope: PollScopeResource,
  ): PrimitiveOf<Poll>['definition']['scope'] {
    return scope.type === 'community_channel'
      ? {
          firstIdentifier: scope.communityId,
          secondIdentifier: scope.channelId,
          type: scope.type,
        }
      : {
          firstIdentifier: scope.conversationId,
          secondIdentifier: undefined,
          type: scope.type,
        };
  }

  public fromResource(resource: PollResource): Poll {
    const scope = this.scopeFromResource(resource.scope);
    const poll = PollAggregate.fromPrimitives({
      createdAt: resource.createdAt,
      definition: {
        allowsMultipleVotes: resource.allowsMultipleVotes,
        creatorIdentityId: resource.creatorIdentityId,
        expiresAt: resource.expiresAt ?? null,
        options: resource.options,
        question: resource.question,
        scope,
      },
      id: resource.id,
      status: resource.status,
      votes: resource.votes,
    });

    this.projections.set(poll, resource);

    return poll;
  }

  public toCreateRequest(poll: Poll): CreatePollRequest {
    const primitives: PrimitiveOf<Poll> = poll.toPrimitives();
    const definition = primitives.definition;
    const common = {
      allowsMultipleVotes: definition.allowsMultipleVotes,
      expiresAt: definition.expiresAt,
      options: definition.options,
      question: definition.question,
    };

    return definition.scope.type === 'community_channel'
      ? {
          ...common,
          channelId: definition.scope.secondIdentifier ?? '',
          communityId: definition.scope.firstIdentifier,
          scopeType: 'community_channel',
        }
      : {
          ...common,
          conversationId: definition.scope.firstIdentifier,
          scopeType: 'group_conversation',
        };
  }

  public toResource(poll: Poll): PollResource {
    const projection = this.projections.get(poll);
    const primitives: PrimitiveOf<Poll> = poll.toPrimitives();

    if (!projection) throw new PollProjectionNotFoundError();

    return {
      ...projection,
      status: primitives.status as PollResource['status'],
      votes: primitives.votes,
    };
  }
}
