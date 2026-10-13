import { GroupMailboxGenerationLog } from '../../../../contexts/groupMailboxes/domain/GroupMailboxGenerationLog';
import { GroupMailboxGenerationSecret } from '../../../../contexts/groupMailboxes/domain/value-objects/GroupMailboxGenerationSecret';

const secret = (fill: number): GroupMailboxGenerationSecret =>
  GroupMailboxGenerationSecret.fromBytes(new Uint8Array(32).fill(fill));
const HOUR = 60 * 60 * 1000;

describe(GroupMailboxGenerationLog.name, () => {
  it('starts empty, as the null log of a conversation without a group', () => {
    const log = GroupMailboxGenerationLog.empty();

    expect(log.isEmpty()).toBe(true);
    expect(() => log.current()).toThrow();
    expect(log.readable(0)).toEqual([]);
  });

  it('numbers generations from zero and advances one per removal', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n)
      .advance(secret(2), 3n, 10);

    expect(log.current().index).toBe(1);
    expect(log.current().secret.isEqual(secret(2))).toBe(true);
    expect(log.current().epoch).toBe(3n);
  });

  it('keeps the previous generation readable for the 24 hour drain window only', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n)
      .advance(secret(2), 1n, 0);

    expect(log.readable(24 * HOUR).map(({ index }) => index)).toEqual([1, 0]);
    expect(log.readable(24 * HOUR + 1).map(({ index }) => index)).toEqual([1]);
  });

  it('rewinds to the generation that held at an epoch when a competing commit wins', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n)
      .advance(secret(2), 4n, 5)
      .rewind(3n);

    expect(log.current().index).toBe(0);
    expect(log.readable(Number.MAX_SAFE_INTEGER)).toHaveLength(1);
  });

  it('round-trips through primitives without changing a generation', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n)
      .advance(secret(2), 7n, 42);
    const restored = GroupMailboxGenerationLog.fromPrimitives(
      log.toPrimitives(),
    );

    expect(restored.toPrimitives()).toEqual(log.toPrimitives());
    expect(restored.current().epoch).toBe(7n);
  });

  it('refuses to start twice', () => {
    expect(() =>
      GroupMailboxGenerationLog.empty()
        .start(secret(1), 0n)
        .start(secret(2), 1n),
    ).toThrow();
  });
});
