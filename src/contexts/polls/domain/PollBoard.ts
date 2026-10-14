import { assert, Timestamp } from '@haskou/value-objects';

import type { PollSnapshot } from './PollSnapshot';
import type { PollVoteSnapshot } from './PollVoteSnapshot';

import { PollOption } from './entities/PollOption';
import { PollOptionsCountError } from './errors/PollOptionsCountError';
import { PollActorId } from './value-objects/PollActorId';
import { PollMultipleVotePermission } from './value-objects/PollMultipleVotePermission';
import { PollOptionId } from './value-objects/PollOptionId';
import { PollQuestion } from './value-objects/PollQuestion';

/**
 * Folds the polls of one conversation from records its members wrote, in
 * any order. A poll that breaks the poll rules is ignored, and the first
 * poll under an id wins. Each voter's latest vote by createdAt counts; one
 * selecting nothing withdraws it, and one the poll cannot hold is ignored.
 * Only the creator closes a poll; the earliest close wins and votes made
 * after it do not count. Votes and closes that arrive before their poll
 * wait for it. Vote and close times are clamped to 30 seconds past their
 * arrival, so a far-future clock cannot win forever.
 */
export class PollBoard {
  private static readonly MAX_FUTURE_SKEW_MS = 30_000;
  private static readonly MAX_OPTIONS = 10;
  private static readonly MIN_OPTIONS = 2;

  /** When each closed poll closed, by poll id. */
  private readonly closedAt = new Map<string, number>();
  private readonly pendingCloses: Parameters<PollBoard['close']>[0][] = [];
  private readonly pendingVotes: Parameters<PollBoard['vote']>[0][] = [];
  private readonly polled = new Map<
    string,
    Parameters<PollBoard['create']>[0]
  >();

  /** Each voter's latest vote, by poll id and voter. */
  private readonly votes = new Map<string, Map<string, PollVoteSnapshot>>();

  private static clamped(createdAt: number, receivedAt: Timestamp): number {
    return Math.min(
      createdAt,
      receivedAt.valueOf() + PollBoard.MAX_FUTURE_SKEW_MS,
    );
  }

  /** Whether `poll` can hold the selection of `vote`. */
  private static holds(
    poll: Parameters<PollBoard['create']>[0],
    vote: Parameters<PollBoard['vote']>[0],
  ): boolean {
    try {
      const optionIds = vote.optionIds.map(PollOptionId.fromString);
      const options = poll.options.map(PollOption.fromPrimitives);

      return (
        new Set(vote.optionIds).size === vote.optionIds.length &&
        PollMultipleVotePermission.fromBoolean(poll.allowsMultipleVotes).allows(
          optionIds.length,
        ) &&
        optionIds.every((optionId) =>
          options.some((option) => option.belongsTo(optionId)),
        )
      );
    } catch {
      return false;
    }
  }

  private admitVote(vote: Parameters<PollBoard['vote']>[0]): void {
    const poll = this.polled.get(vote.pollId);
    const votes = this.votes.get(vote.pollId);
    const current = votes?.get(vote.voterIdentityId);

    if (!poll || !votes || (current && current.createdAt >= vote.createdAt)) {
      return;
    }

    if (!PollBoard.holds(poll, vote)) return;

    votes.set(vote.voterIdentityId, {
      createdAt: vote.createdAt,
      optionIds: vote.optionIds,
      voterIdentityId: vote.voterIdentityId,
    });
  }

  private admitClose(close: Parameters<PollBoard['close']>[0]): void {
    const poll = this.polled.get(close.pollId);

    if (close.closerIdentityId !== poll?.creatorIdentityId) return;

    this.closedAt.set(
      close.pollId,
      Math.min(
        this.closedAt.get(close.pollId) ?? close.createdAt,
        close.createdAt,
      ),
    );
  }

  /**
   * `poll` in canonical form. Throws when it breaks the poll rules: two to
   * ten options under distinct ids, a question and option texts within
   * their lengths.
   */
  public static canonical(
    poll: Parameters<PollBoard['create']>[0],
  ): Parameters<PollBoard['create']>[0] {
    const options = poll.options.map(PollOption.fromPrimitives);
    const ids = new Set(options.map((option) => option.toPrimitives().id));

    assert(
      options.length >= PollBoard.MIN_OPTIONS &&
        options.length <= PollBoard.MAX_OPTIONS &&
        ids.size === options.length,
      new PollOptionsCountError(),
    );

    return {
      allowsMultipleVotes: PollMultipleVotePermission.fromBoolean(
        poll.allowsMultipleVotes,
      ).valueOf(),
      createdAt: poll.createdAt,
      creatorIdentityId: PollActorId.fromString(
        poll.creatorIdentityId,
      ).toString(),
      id: poll.id,
      options: options.map((option) => option.toPrimitives()),
      question: PollQuestion.fromString(poll.question).toString(),
    };
  }

  public create(poll: {
    allowsMultipleVotes: boolean;
    createdAt: number;
    creatorIdentityId: string;
    id: string;
    options: { id: string; text: string }[];
    question: string;
  }): void {
    if (this.polled.has(poll.id)) return;
    let valid: Parameters<PollBoard['create']>[0];

    try {
      valid = PollBoard.canonical(poll);
    } catch {
      return;
    }

    this.polled.set(valid.id, valid);
    this.votes.set(valid.id, new Map());
    this.pendingVotes
      .filter(({ pollId }) => pollId === valid.id)
      .forEach((vote) => this.admitVote(vote));
    this.pendingCloses
      .filter(({ pollId }) => pollId === valid.id)
      .forEach((close) => this.admitClose(close));
  }

  public vote(
    vote: PollVoteSnapshot & { pollId: string },
    receivedAt: Timestamp,
  ): void {
    const clamped = {
      ...vote,
      createdAt: PollBoard.clamped(vote.createdAt, receivedAt),
    };

    if (this.polled.has(vote.pollId)) {
      this.admitVote(clamped);
    } else {
      this.pendingVotes.push(clamped);
    }
  }

  public close(
    close: { closerIdentityId: string; createdAt: number; pollId: string },
    receivedAt: Timestamp,
  ): void {
    const clamped = {
      ...close,
      createdAt: PollBoard.clamped(close.createdAt, receivedAt),
    };

    if (this.polled.has(close.pollId)) {
      this.admitClose(clamped);
    } else {
      this.pendingCloses.push(clamped);
    }
  }

  /** Every valid poll, oldest first. */
  public polls(): PollSnapshot[] {
    return [...this.polled.values()]
      .map((poll): PollSnapshot => {
        const closedAt = this.closedAt.get(poll.id);

        return {
          ...poll,
          status: closedAt === undefined ? 'open' : 'closed',
          votes: [...(this.votes.get(poll.id)?.values() ?? [])].filter(
            (vote) =>
              vote.optionIds.length > 0 &&
              (closedAt === undefined || vote.createdAt <= closedAt),
          ),
        };
      })
      .sort((left, right) => left.createdAt - right.createdAt);
  }
}
