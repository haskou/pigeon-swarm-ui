import { MlsTakenCommits } from '../../../../contexts/communities/domain/MlsTakenCommits';

describe('MlsTakenCommits', () => {
  it('knows no commit for a group it has not seen take one', () => {
    const taken = MlsTakenCommits.none(4n);

    expect(taken.epoch).toBe(4n);
    expect(taken.commitIn(3)).toBeUndefined();
  });

  it('keeps the commit the group took in an epoch, and the epoch it led to', () => {
    const taken = MlsTakenCommits.none(4n).took(4, 'a').took(5, 'b');

    expect(taken.epoch).toBe(6n);
    expect(taken.commitIn(4)).toBe('a');
    expect(taken.commitIn(5)).toBe('b');
  });

  it('forgets the later epochs when a rival replaces the commit of an earlier one', () => {
    const taken = MlsTakenCommits.none(4n)
      .took(4, 'a')
      .took(5, 'b')
      .took(4, 'rival');

    expect(taken.epoch).toBe(5n);
    expect(taken.commitIn(4)).toBe('rival');
    expect(taken.commitIn(5)).toBeUndefined();
  });

  it('keeps only the epochs a sync still lists commits for', () => {
    const taken = MlsTakenCommits.none(1n)
      .took(1, 'a')
      .took(2, 'b')
      .took(3, 'c')
      .took(4, 'd');

    expect(taken.epoch).toBe(5n);
    expect(taken.commitIn(1)).toBeUndefined();
    expect(taken.commitIn(2)).toBeUndefined();
    expect(taken.commitIn(3)).toBe('c');
    expect(taken.commitIn(4)).toBe('d');
  });

  it('round-trips its primitives and refuses malformed ones', () => {
    const taken = MlsTakenCommits.none(7n).took(7, 'a').took(8, 'b');

    expect(taken.toPrimitives()).toEqual({
      commits: { 7: 'a', 8: 'b' },
      epoch: '9',
    });
    expect(
      MlsTakenCommits.fromPrimitives(taken.toPrimitives()).toPrimitives(),
    ).toEqual(taken.toPrimitives());

    for (const malformed of [
      { epoch: '-1' },
      { epoch: '1e3' },
      { commits: { 9: 'a' } },
      { commits: { 6: 'a' } },
      { commits: { x: 'a' } },
      { commits: { 8: '' } },
      { commits: { 8: 3 } },
      { commits: null },
    ]) {
      expect(() =>
        MlsTakenCommits.fromPrimitives({
          ...taken.toPrimitives(),
          ...malformed,
        } as never),
      ).toThrow(RangeError);
    }
  });
});
