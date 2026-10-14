import { type PrimitiveOf } from '@haskou/value-objects';

import type { Poll } from '../../domain/Poll';
import type { CreatePollRequest } from './resources/CreatePollRequest';
import type { PollResource } from './resources/PollResource';
import type { PollScopeFields } from './resources/PollScopeFields';
import type { PollScopeResource } from './resources/PollScopeResource';

import { Poll as PollAggregate } from '../../domain/Poll';
import { PollProjectionNotFoundError } from './errors/PollProjectionNotFoundError';

export class PollMapper {
  private readonly projections = new WeakMap<Poll, PollResource>();

  private scopeFromResource(
    scope: PollScopeResource,
  ): PrimitiveOf<Poll>['definition']['scope'] {
    return {
      firstIdentifier: scope.communityId,
      secondIdentifier: scope.channelId,
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

  public toScopeFields(poll: Poll): PollScopeFields {
    const { scope } = poll.toPrimitives().definition;

    return {
      channelId: scope.secondIdentifier,
      communityId: scope.firstIdentifier,
    };
  }

  public toCreateRequest(poll: Poll): CreatePollRequest {
    const primitives: PrimitiveOf<Poll> = poll.toPrimitives();
    const definition = primitives.definition;

    return {
      allowsMultipleVotes: definition.allowsMultipleVotes,
      channelId: definition.scope.secondIdentifier,
      communityId: definition.scope.firstIdentifier,
      createdAt: primitives.createdAt,
      expiresAt: definition.expiresAt,
      options: definition.options,
      pollId: primitives.id,
      question: definition.question,
      scopeType: 'community_channel',
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
