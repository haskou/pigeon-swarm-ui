import { Timestamp } from '@haskou/value-objects';

import { DeviceHistoryFloor } from '../../../../../contexts/identities/domain/value-objects/DeviceHistoryFloor';

describe(DeviceHistoryFloor.name, () => {
  const at = new Timestamp(Date.UTC(2026, 4, 31));
  const floor = DeviceHistoryFloor.at(at);

  it('copies only records created at or after the floor', () => {
    expect(floor.admits(at.toMilliseconds())).toBe(true);
    expect(floor.admits(at.toMilliseconds() - 1)).toBe(false);
  });

  it('copies every record dated from the epoch on when open', () => {
    expect(DeviceHistoryFloor.OPEN.admits(0)).toBe(true);
    expect(DeviceHistoryFloor.OPEN.admits(at.toMilliseconds())).toBe(true);
  });

  it.each([
    ['far past the Date range', 1e300],
    ['far before the Date range', -1e300],
    ['just past the Date range', 9e15],
    ['fractional', at.toMilliseconds() + 0.5],
    ['not a number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])(
    'skips a record whose createdAt is %s without throwing',
    (_case, createdAt) => {
      expect(DeviceHistoryFloor.OPEN.admits(createdAt)).toBe(false);
    },
  );
});
