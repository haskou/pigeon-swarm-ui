import { GroupMailboxGeneration } from '../../../../contexts/groupMailboxes/domain/GroupMailboxGeneration';
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

  it('numbers generations from zero and advances one per membership change', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n, 'tree-0')
      .advance(secret(2), 3n, 'tree-3', 10);

    expect(log.current().index).toBe(1);
    expect(log.current().secret.isEqual(secret(2))).toBe(true);
    expect(log.current().epoch).toBe(3n);
    expect(log.current().tree).toBe('tree-3');
  });

  it('keeps the previous generation readable for the 6 hour drain window only', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n, 'tree-0')
      .advance(secret(2), 1n, 'tree-1', 0);

    expect(GroupMailboxGeneration.DRAIN_WINDOW_MS).toBe(6 * HOUR);
    expect(log.readable(6 * HOUR).map(({ index }) => index)).toEqual([1, 0]);
    expect(log.readable(6 * HOUR + 1).map(({ index }) => index)).toEqual([1]);
  });

  it('rewinds to the generation that held at an epoch when a competing commit wins', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n, 'tree-0')
      .advance(secret(2), 4n, 'tree-4', 5)
      .rewind(3n);

    expect(log.current().index).toBe(0);
    expect(log.current().tree).toBe('tree-0');
    expect(log.readable(Number.MAX_SAFE_INTEGER)).toHaveLength(1);
  });

  it('lists as rewindable only the generations of the last 8 epochs, newest first', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n, 'tree-0')
      .advance(secret(2), 2n, 'tree-2', 5)
      .advance(secret(3), 9n, 'tree-9', 6);

    expect(GroupMailboxGenerationLog.RIVAL_EPOCHS).toBe(8n);
    expect(GroupMailboxGenerationLog.empty().rewindable()).toEqual([]);
    expect(log.rewindable().map(({ index }) => index)).toEqual([2, 1]);
  });

  it('round-trips through primitives without changing a generation', () => {
    const log = GroupMailboxGenerationLog.empty()
      .start(secret(1), 0n, 'tree-0')
      .advance(secret(2), 7n, 'tree-7', 42);
    const restored = GroupMailboxGenerationLog.fromPrimitives(
      log.toPrimitives(),
    );

    expect(restored.toPrimitives()).toEqual(log.toPrimitives());
    expect(restored.current().epoch).toBe(7n);
    expect(restored.current().tree).toBe('tree-7');
  });

  it('refuses to start twice', () => {
    expect(() =>
      GroupMailboxGenerationLog.empty()
        .start(secret(1), 0n, 'tree-0')
        .start(secret(2), 1n, 'tree-1'),
    ).toThrow();
  });
});
