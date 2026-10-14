import { Timestamp } from '@haskou/value-objects';

import { PollBoard } from '../../../../contexts/polls/domain/PollBoard';

describe(PollBoard.name, () => {
  const receivedAt = new Timestamp(10_000);
  const created = {
    allowsMultipleVotes: false,
    createdAt: 1_000,
    creatorIdentityId: 'alice',
    id: 'poll-1',
    options: [
      { id: 'tea', text: 'Tea' },
      { id: 'coffee', text: 'Coffee' },
    ],
    question: 'Which one?',
  };
  const vote = (
    voterIdentityId: string,
    optionIds: string[],
    createdAt: number,
  ) => ({ createdAt, optionIds, pollId: 'poll-1', voterIdentityId });
  const tally = (board: PollBoard) =>
    board.polls().map(({ id, status, votes }) => ({
      id,
      status,
      votes: votes.map(
        ({ optionIds, voterIdentityId }) =>
          `${voterIdentityId}:${optionIds.join('+')}`,
      ),
    }));

  it('shows a created poll open and without votes', () => {
    const board = new PollBoard();

    board.create(created);

    expect(board.polls()).toEqual([{ ...created, status: 'open', votes: [] }]);
  });

  it('keeps the latest vote of each voter, whatever order they arrive in', () => {
    const board = new PollBoard();

    board.create(created);
    board.vote(vote('bob', ['coffee'], 2_000), receivedAt);
    board.vote(vote('bob', ['tea'], 1_500), receivedAt);
    board.vote(vote('carol', ['tea'], 1_600), receivedAt);

    expect(tally(board)).toEqual([
      { id: 'poll-1', status: 'open', votes: ['bob:coffee', 'carol:tea'] },
    ]);
  });

  it('removes a vote whose latest change selects nothing', () => {
    const board = new PollBoard();

    board.create(created);
    board.vote(vote('bob', ['coffee'], 2_000), receivedAt);
    board.vote(vote('bob', [], 2_100), receivedAt);

    expect(tally(board)[0].votes).toEqual([]);
  });

  it('counts a vote that arrived before its poll', () => {
    const board = new PollBoard();

    board.vote(vote('bob', ['tea'], 2_000), receivedAt);
    expect(board.polls()).toEqual([]);
    board.create(created);

    expect(tally(board)[0].votes).toEqual(['bob:tea']);
  });

  it.each([
    ['an option the poll lacks', ['milk']],
    ['two options of a single-choice poll', ['tea', 'coffee']],
  ])('ignores a vote for %s', (_label, optionIds) => {
    const board = new PollBoard();

    board.create(created);
    board.vote(vote('bob', optionIds, 2_000), receivedAt);

    expect(tally(board)[0].votes).toEqual([]);
  });

  it('accepts several options of a multiple-choice poll', () => {
    const board = new PollBoard();

    board.create({ ...created, allowsMultipleVotes: true });
    board.vote(vote('bob', ['tea', 'coffee'], 2_000), receivedAt);

    expect(tally(board)[0].votes).toEqual(['bob:tea+coffee']);
  });

  it('clamps a far-future vote so a later one still wins', () => {
    const board = new PollBoard();

    board.create(created);
    board.vote(vote('bob', ['coffee'], 99_999_999), receivedAt);
    board.vote(
      vote('bob', ['tea'], 41_000),
      new Timestamp(receivedAt.valueOf() + 60_000),
    );

    expect(tally(board)[0].votes).toEqual(['bob:tea']);
  });

  it('closes a poll on its creator’s close and drops the votes after it', () => {
    const board = new PollBoard();

    board.create(created);
    board.vote(vote('bob', ['tea'], 2_000), receivedAt);
    board.vote(vote('carol', ['coffee'], 4_000), receivedAt);
    board.close(
      { closerIdentityId: 'alice', createdAt: 3_000, pollId: 'poll-1' },
      receivedAt,
    );

    expect(tally(board)).toEqual([
      { id: 'poll-1', status: 'closed', votes: ['bob:tea'] },
    ]);
  });

  it('ignores a close from anyone but the poll creator', () => {
    const board = new PollBoard();

    board.create(created);
    board.close(
      { closerIdentityId: 'bob', createdAt: 3_000, pollId: 'poll-1' },
      receivedAt,
    );

    expect(tally(board)[0].status).toBe('open');
  });

  it.each([
    ['a single option', { options: [{ id: 'tea', text: 'Tea' }] }],
    [
      'eleven options',
      {
        options: Array.from({ length: 11 }, (_, index) => ({
          id: `option-${index}`,
          text: `Option ${index}`,
        })),
      },
    ],
    [
      'two options under one id',
      {
        options: [
          { id: 'tea', text: 'Tea' },
          { id: 'tea', text: 'Green tea' },
        ],
      },
    ],
    ['an empty question', { question: ' ' }],
    ['a question over 200 characters', { question: 'q'.repeat(201) }],
    [
      'an option over 120 characters',
      {
        options: [
          { id: 'tea', text: 't'.repeat(121) },
          { id: 'coffee', text: 'Coffee' },
        ],
      },
    ],
  ])('ignores a poll with %s', (_label, overrides) => {
    const board = new PollBoard();

    board.create({ ...created, ...overrides });

    expect(board.polls()).toEqual([]);
  });

  it('keeps the first poll created under an id', () => {
    const board = new PollBoard();

    board.create(created);
    board.create({ ...created, question: 'Replaced?' });

    expect(board.polls()[0].question).toBe('Which one?');
  });

  it('lists the polls in the order they were created', () => {
    const board = new PollBoard();

    board.create({ ...created, createdAt: 2_000, id: 'poll-2' });
    board.create(created);

    expect(board.polls().map(({ id }) => id)).toEqual(['poll-1', 'poll-2']);
  });
});
