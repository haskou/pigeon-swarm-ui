import { assert } from '@haskou/value-objects';

import { InvalidPollScopeError } from '../errors/InvalidPollScopeError';
import { PollScopeIdentifier } from './PollScopeIdentifier';
import { PollScopeType } from './PollScopeType';

/**
 * Where a node-backed poll lives: always a community channel. Group
 * conversation polls travel as MLS records in the group mailboxes instead.
 */
export class PollScope {
  public static communityChannel(
    communityId: PollScopeIdentifier,
    channelId: PollScopeIdentifier,
  ): PollScope {
    return new PollScope(
      PollScopeType.COMMUNITY_CHANNEL,
      communityId,
      channelId,
    );
  }

  /** Throws InvalidPollScopeError for anything but a community channel. */
  public static fromPrimitives(primitives: {
    firstIdentifier: string;
    secondIdentifier?: string;
    type: string;
  }): PollScope {
    assert(
      primitives.type === PollScopeType.COMMUNITY_CHANNEL.valueOf(),
      new InvalidPollScopeError(),
    );
    assert(primitives.secondIdentifier, new InvalidPollScopeError());

    return PollScope.communityChannel(
      PollScopeIdentifier.fromString(primitives.firstIdentifier),
      PollScopeIdentifier.fromString(primitives.secondIdentifier),
    );
  }

  private constructor(
    private readonly type: PollScopeType,
    private readonly firstIdentifier: PollScopeIdentifier,
    private readonly secondIdentifier: PollScopeIdentifier,
  ) {}

  public toPrimitives() {
    return {
      firstIdentifier: this.firstIdentifier.toString(),
      secondIdentifier: this.secondIdentifier.toString(),
      type: this.type.valueOf(),
    };
  }
}
