import type { MlsUpdateCadencePrimitives } from './MlsUpdateCadencePrimitives';

/**
 * When a device next commits an update of its own leaf in an MLS group.
 * A leaked copy of the device's group state keeps reading the group, call
 * media keys included, until a commit of this device with an update path
 * (an update or a removal; an add carries none) replaces its leaf keys.
 * The commit is due once `INTERVAL_MS` plus this cadence's jitter passed
 * since the device last took fresh leaf keys, or once `MAX_SENT`
 * application messages were sent since. The jitter, below `JITTER_MS`,
 * keeps devices from all committing together.
 */
export class MlsUpdateCadence {
  public static readonly INTERVAL_MS = 24 * 60 * 60 * 1000;
  public static readonly JITTER_MS = 60 * 60 * 1000;
  public static readonly MAX_SENT = 1000;

  private constructor(
    public readonly lastPathCommitAt: number,
    public readonly keyEpoch: bigint,
    public readonly jitterMs: number,
    public readonly sentSinceUpdate: number,
  ) {}

  public static fromPrimitives(
    primitives: MlsUpdateCadencePrimitives,
  ): MlsUpdateCadence {
    const { jitterMs, keyEpoch, lastPathCommitAt, sentSinceUpdate } =
      primitives;

    if (
      !Number.isFinite(lastPathCommitAt) ||
      !/^\d+$/u.test(keyEpoch) ||
      !Number.isInteger(jitterMs) ||
      jitterMs < 0 ||
      jitterMs >= MlsUpdateCadence.JITTER_MS ||
      !Number.isInteger(sentSinceUpdate) ||
      sentSinceUpdate < 0
    ) {
      throw new RangeError('Invalid MLS update cadence');
    }

    return new MlsUpdateCadence(
      lastPathCommitAt,
      BigInt(keyEpoch),
      jitterMs,
      sentSinceUpdate,
    );
  }

  /**
   * The cadence once this device took fresh leaf keys at `now`, the first
   * epoch they are in being `keyEpoch`; `random`, in [0, 1), draws the
   * jitter.
   */
  public static startedAt(
    now: number,
    keyEpoch: bigint,
    random: number,
  ): MlsUpdateCadence {
    if (!(random >= 0 && random < 1)) {
      throw new RangeError('Jitter must be drawn from [0, 1)');
    }

    return new MlsUpdateCadence(
      now,
      keyEpoch,
      Math.floor(random * MlsUpdateCadence.JITTER_MS),
      0,
    );
  }

  /** The cadence after one more application message. */
  public afterSend(): MlsUpdateCadence {
    return new MlsUpdateCadence(
      this.lastPathCommitAt,
      this.keyEpoch,
      this.jitterMs,
      this.sentSinceUpdate + 1,
    );
  }

  public isDueAt(now: number): boolean {
    return (
      now - this.lastPathCommitAt >
        MlsUpdateCadence.INTERVAL_MS + this.jitterMs ||
      this.sentSinceUpdate >= MlsUpdateCadence.MAX_SENT
    );
  }

  /**
   * Whether a rival commit replacing the one the group took in `epoch`
   * undid the fresh leaf keys: the group left every epoch after `epoch`.
   */
  public isUndoneByReplacing(epoch: bigint): boolean {
    return epoch < this.keyEpoch;
  }

  public toPrimitives(): MlsUpdateCadencePrimitives {
    return {
      jitterMs: this.jitterMs,
      keyEpoch: this.keyEpoch.toString(),
      lastPathCommitAt: this.lastPathCommitAt,
      sentSinceUpdate: this.sentSinceUpdate,
    };
  }
}
