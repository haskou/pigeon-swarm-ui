import { Timestamp } from '@haskou/value-objects';

import { DeviceHistoryFloor } from '../../../../../contexts/identities/domain/value-objects/DeviceHistoryFloor';

describe(DeviceHistoryFloor.name, () => {
  const at = new Timestamp(Date.UTC(2026, 4, 31));
  const floor = DeviceHistoryFloor.at(at);

  it('copies only records created at or after the floor', () => {
    expect(floor.admits(at)).toBe(true);
    expect(floor.admits(at.addMilliseconds(-1))).toBe(false);
  });

  it('keeps a delivered record whose sender clock lags by up to five minutes', () => {
    expect(floor.admitsDelivered(at.addMinutes(-5))).toBe(true);
    expect(floor.admitsDelivered(at.addMinutes(-5).addMilliseconds(-1))).toBe(
      false,
    );
  });

  it('keeps every record when open', () => {
    expect(DeviceHistoryFloor.OPEN.admits(new Timestamp(0))).toBe(true);
    expect(DeviceHistoryFloor.OPEN.admitsDelivered(new Timestamp(0))).toBe(
      true,
    );
  });

  it('receives a floor up to five minutes ahead of this device clock', () => {
    expect(
      DeviceHistoryFloor.isReceivable(at.addMinutes(5).toMilliseconds(), at),
    ).toBe(true);
    expect(DeviceHistoryFloor.isReceivable(0, at)).toBe(true);
  });

  it.each([
    ['further ahead than the clock skew', at.addMinutes(6).toMilliseconds()],
    ['negative', -1],
    ['fractional', 1.5],
    ['not finite', Number.POSITIVE_INFINITY],
  ])('refuses a received floor that is %s', (_case, value) => {
    expect(DeviceHistoryFloor.isReceivable(value, at)).toBe(false);
  });
});
