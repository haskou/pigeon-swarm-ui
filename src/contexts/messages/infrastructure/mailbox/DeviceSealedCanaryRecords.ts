import type { DeviceRootRowKeys } from '@haskou/pigeon-swarm-crypto';

import type { DeviceSealedCanaryRecord as CanaryRecord } from './DeviceSealedCanaryRecord';
import type { DeviceSealedRowRoots as Roots } from './DeviceSealedRowRoots';

/**
 * The rules of a device-sealed canary record, shared by the stores that seal
 * rows under the device-sealed root: what a session's roots make of the
 * stored record (`decide`), and the record each outcome stores.
 */
export class DeviceSealedCanaryRecords {
  /** How many replaced roots a canary record lists, the latest ones. */
  private static readonly MAX_RETIRED = 16;

  /** The error a store rejects with for a root the record refuses. */
  public static readonly REPLACED_ROOT = 'Device sealed root was replaced.';

  /** `retired` plus `added`, keeping only the latest `MAX_RETIRED`. */
  private static bounded(
    retired: readonly Uint8Array[],
    added: readonly Uint8Array[],
  ): Uint8Array[] {
    return [...retired, ...added].slice(-DeviceSealedCanaryRecords.MAX_RETIRED);
  }

  /**
   * Whether the record holds a root published at a generation the session's
   * does not exceed: the session's root is older, or not the one now in use.
   */
  private static isOutdated(
    record: CanaryRecord,
    generation: number | undefined,
  ): boolean {
    return (
      record.generation !== undefined &&
      generation !== undefined &&
      generation <= record.generation
    );
  }

  /** The later of two generations of one root; undefined when both unknown. */
  private static latest(
    stored: number | undefined,
    generation: number | undefined,
  ): number | undefined {
    if (stored === undefined) return generation;

    if (generation === undefined) return stored;

    return Math.max(stored, generation);
  }

  /** A canary record, carrying the generation only when it is known. */
  private static record(
    sealed: Uint8Array,
    retired: readonly Uint8Array[],
    generation: number | undefined,
  ): CanaryRecord {
    return generation === undefined
      ? { retired, sealed }
      : { generation, retired, sealed };
  }

  /**
   * What a store does with the stored record for `roots`:
   *
   * - `refuse` a root the record lists as retired, and a root published at a
   *   generation the record's does not exceed, keeping its rows;
   * - `retire` under the current root: list the `replaced` root when it is not
   *   yet (`retired`);
   * - `reseal` under the replaced root: re-seal every row under the current
   *   one (`resealed`);
   * - `renew` otherwise: drop the rows and renew the canary (`renewed`).
   */
  public static decide(
    held: CanaryRecord | undefined,
    { current, generation, replaced }: Roots,
  ): 'refuse' | 'renew' | 'reseal' | 'retire' {
    if (DeviceSealedCanaryRecords.isRetired(held, current)) return 'refuse';

    if (!held) return 'renew';

    if (current.opensCanary(held.sealed)) return 'retire';

    if (replaced?.opensCanary(held.sealed)) return 'reseal';

    return DeviceSealedCanaryRecords.isOutdated(held, generation)
      ? 'refuse'
      : 'renew';
  }

  /** Whether the record lists the root behind `keys` as replaced. */
  public static isRetired(
    record: CanaryRecord | undefined,
    keys: DeviceRootRowKeys,
  ): boolean {
    return (record?.retired ?? []).some((sealed) => keys.opensCanary(sealed));
  }

  /**
   * Whether the record is already settled for `roots`: sealed under the
   * current root, the replaced root listed, and the session's generation
   * recorded.
   */
  public static isSettled(
    record: CanaryRecord | undefined,
    roots: Roots,
  ): boolean {
    const { current, generation, replaced } = roots;

    return (
      record !== undefined &&
      current.opensCanary(record.sealed) &&
      (!replaced || DeviceSealedCanaryRecords.isRetired(record, replaced)) &&
      DeviceSealedCanaryRecords.latest(record.generation, generation) ===
        record.generation
    );
  }

  /**
   * The record once the rows are dropped: a canary under `current` with the
   * session's generation, listing the `replaced` root. The dropped canary's
   * root is listed only when both generations are known, so it is known to be
   * older: a root that cannot be ordered may be the one another session uses
   * now, and listing it would lock that session out.
   */
  public static renewed(
    held: CanaryRecord | undefined,
    { current, generation, replaced }: Roots,
  ): CanaryRecord {
    const older =
      held?.generation !== undefined && generation !== undefined
        ? [held.sealed]
        : [];
    const listed =
      replaced && !DeviceSealedCanaryRecords.isRetired(held, replaced)
        ? [replaced.sealCanary()]
        : [];

    return DeviceSealedCanaryRecords.record(
      current.sealCanary(),
      DeviceSealedCanaryRecords.bounded(held?.retired ?? [], [
        ...older,
        ...listed,
      ]),
      generation,
    );
  }

  /**
   * The record once the rows are re-sealed from the `replaced` root: a canary
   * under `current` with the session's generation, listing the replaced root.
   */
  public static resealed(
    held: CanaryRecord,
    {
      current,
      generation,
      replaced,
    }: Roots & { readonly replaced: DeviceRootRowKeys },
  ): CanaryRecord {
    return DeviceSealedCanaryRecords.record(
      current.sealCanary(),
      DeviceSealedCanaryRecords.bounded(held.retired ?? [], [
        replaced.sealCanary(),
      ]),
      generation,
    );
  }

  /**
   * The record under the current root once the `replaced` root is listed and
   * the later of the stored and the session's generation recorded; undefined
   * when `held` already is.
   */
  public static retired(
    held: CanaryRecord,
    { generation, replaced }: Roots,
  ): CanaryRecord | undefined {
    const listed =
      !replaced || DeviceSealedCanaryRecords.isRetired(held, replaced);
    const stamped = DeviceSealedCanaryRecords.latest(
      held.generation,
      generation,
    );

    if (listed && stamped === held.generation) return undefined;

    return DeviceSealedCanaryRecords.record(
      held.sealed,
      listed
        ? (held.retired ?? [])
        : DeviceSealedCanaryRecords.bounded(held.retired ?? [], [
            replaced.sealCanary(),
          ]),
      stamped,
    );
  }
}
