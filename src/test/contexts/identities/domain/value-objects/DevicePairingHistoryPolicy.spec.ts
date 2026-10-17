import { Timestamp } from '@haskou/value-objects';

import { DevicePairingHistoryPolicy } from '../../../../../contexts/identities/domain/value-objects/DevicePairingHistoryPolicy';

describe(DevicePairingHistoryPolicy.name, () => {
  const now = new Timestamp(Date.UTC(2026, 4, 31));

  it('defaults to the last 30 days', () => {
    expect(DevicePairingHistoryPolicy.DEFAULT).toBe(
      DevicePairingHistoryPolicy.LAST_30_DAYS,
    );
  });

  it('keeps the last 30 days under its default', () => {
    const floor = DevicePairingHistoryPolicy.DEFAULT.floorAt(now);

    expect(floor.admits(now.addDays(-30))).toBe(true);
    expect(floor.admits(now.addDays(-30).addMilliseconds(-1))).toBe(false);
  });

  it('keeps every record under All history', () => {
    const floor = DevicePairingHistoryPolicy.ALL.floorAt(now);

    expect(floor.admits(new Timestamp(0))).toBe(true);
  });

  it('keeps no record created before the pairing under Nothing', () => {
    const floor = DevicePairingHistoryPolicy.NONE.floorAt(now);

    expect(floor.admits(now.addMilliseconds(-1))).toBe(false);
    expect(floor.admits(now)).toBe(true);
  });

  it('reads each choice back from its primitive', () => {
    for (const policy of [
      DevicePairingHistoryPolicy.ALL,
      DevicePairingHistoryPolicy.LAST_30_DAYS,
      DevicePairingHistoryPolicy.NONE,
    ]) {
      expect(
        DevicePairingHistoryPolicy.fromPrimitives(policy.valueOf()).isEqual(
          policy,
        ),
      ).toBe(true);
    }
  });

  it('refuses an unknown choice', () => {
    expect(() =>
      DevicePairingHistoryPolicy.fromPrimitives('forever'),
    ).toThrow();
  });
});
