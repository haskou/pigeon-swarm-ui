import { MlsUpdateCadence } from '../../../../contexts/communities/domain/MlsUpdateCadence';

describe('MlsUpdateCadence', () => {
  const START = 1_700_000_000_000;
  const { INTERVAL_MS, JITTER_MS, MAX_SENT } = MlsUpdateCadence;

  it('is due once the interval and its jitter passed, not before', () => {
    const cadence = MlsUpdateCadence.startedAt(START, 3n, 0.5);
    const deadline = START + INTERVAL_MS + JITTER_MS / 2;

    expect(cadence.isDueAt(deadline)).toBe(false);
    expect(cadence.isDueAt(deadline + 1)).toBe(true);
  });

  it('is due when it was stamped after now, so a forged or skewed stamp suppresses no update', () => {
    const cadence = MlsUpdateCadence.startedAt(START, 3n, 0);

    expect(cadence.isDueAt(START)).toBe(false);
    expect(cadence.isDueAt(START - 1)).toBe(true);
    expect(
      MlsUpdateCadence.fromPrimitives({
        ...cadence.toPrimitives(),
        lastPathCommitAt: START + 10 * INTERVAL_MS,
      }).isDueAt(START),
    ).toBe(true);
  });

  it('is due once it counted the most messages it lets a device send', () => {
    let cadence = MlsUpdateCadence.startedAt(START, 3n, 0);

    for (let sent = 1; sent < MAX_SENT; sent += 1) {
      cadence = cadence.afterSend();
    }

    expect(cadence.isDueAt(START)).toBe(false);
    expect(cadence.afterSend().isDueAt(START)).toBe(true);
  });

  it('draws its jitter below the bound it is given', () => {
    expect(
      MlsUpdateCadence.startedAt(START, 0n, 0.999_999_999).jitterMs,
    ).toBeLessThan(JITTER_MS);
    expect(() => MlsUpdateCadence.startedAt(START, 0n, 1)).toThrow(RangeError);
    expect(() => MlsUpdateCadence.startedAt(START, 0n, -0.1)).toThrow(
      RangeError,
    );
  });

  it('is undone only by a rival that replaced the commit before its keys', () => {
    const cadence = MlsUpdateCadence.startedAt(START, 3n, 0);

    expect(cadence.isUndoneByReplacing(2n)).toBe(true);
    expect(cadence.isUndoneByReplacing(3n)).toBe(false);
  });

  it('round-trips its primitives and refuses malformed ones', () => {
    const cadence = MlsUpdateCadence.startedAt(START, 7n, 0.25).afterSend();

    expect(
      MlsUpdateCadence.fromPrimitives(cadence.toPrimitives()).toPrimitives(),
    ).toEqual({
      jitterMs: JITTER_MS / 4,
      keyEpoch: '7',
      lastPathCommitAt: START,
      sentSinceUpdate: 1,
    });

    for (const malformed of [
      { keyEpoch: '-1' },
      { keyEpoch: '1e3' },
      { jitterMs: JITTER_MS },
      { jitterMs: -1 },
      { sentSinceUpdate: 0.5 },
      { lastPathCommitAt: Number.NaN },
    ]) {
      expect(() =>
        MlsUpdateCadence.fromPrimitives({
          ...cadence.toPrimitives(),
          ...malformed,
        }),
      ).toThrow(RangeError);
    }
  });
});
