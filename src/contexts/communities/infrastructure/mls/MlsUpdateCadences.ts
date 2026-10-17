import type { MlsUpdateCadencePrimitives } from '../../domain/MlsUpdateCadencePrimitives';
import type { MlsStateStore } from './MlsStateStore';

import { MlsUpdateCadence } from '../../domain/MlsUpdateCadence';

/**
 * The update cadence of each MLS group this device holds, sealed in the
 * device's MLS state store next to the group state. A group without a
 * readable cadence, as one held from before cadences were kept, is due:
 * the device updates on its first pass.
 */
export class MlsUpdateCadences {
  private static key(groupId: string): string {
    return `${groupId}#cadence`;
  }

  public constructor(
    private readonly store: Pick<MlsStateStore, 'loadGroup' | 'saveGroup'>,
    private readonly clock: () => number,
    /** Draws from [0, 1); see `MlsUpdateCadence.startedAt`. */
    private readonly random: () => number,
  ) {}

  private async load(groupId: string): Promise<MlsUpdateCadence | undefined> {
    const bytes = await this.store.loadGroup(MlsUpdateCadences.key(groupId));

    if (!bytes?.length) return undefined;

    try {
      return MlsUpdateCadence.fromPrimitives(
        JSON.parse(
          new TextDecoder().decode(bytes),
        ) as MlsUpdateCadencePrimitives,
      );
    } catch {
      return undefined;
    }
  }

  private async save(
    groupId: string,
    cadence: MlsUpdateCadence,
  ): Promise<void> {
    await this.store.saveGroup(
      MlsUpdateCadences.key(groupId),
      new TextEncoder().encode(JSON.stringify(cadence.toPrimitives())),
    );
  }

  /** Whether this device should commit an update in the group now. */
  public async isDue(groupId: string): Promise<boolean> {
    return (await this.load(groupId))?.isDueAt(this.clock()) ?? true;
  }

  /** Counts one application message this device sent in the group. */
  public async recordSend(groupId: string): Promise<void> {
    const cadence = await this.load(groupId);

    if (cadence) await this.save(groupId, cadence.afterSend());
  }

  /**
   * Called when a rival commit replaced the one the group took in `epoch`:
   * if that undid this device's fresh leaf keys, the group is due again,
   * so the next pass commits another update.
   */
  public async replaced(groupId: string, epoch: bigint): Promise<void> {
    const cadence = await this.load(groupId);

    if (!cadence?.isUndoneByReplacing(epoch)) return;
    await this.store.saveGroup(
      MlsUpdateCadences.key(groupId),
      new Uint8Array(),
    );
  }

  /**
   * Restarts the cadence: this device just took fresh leaf keys, by
   * creating the group, joining it, or a confirmed commit with an update
   * path, and `keyEpoch` is the first epoch they are in.
   */
  public async restart(groupId: string, keyEpoch: bigint): Promise<void> {
    await this.save(
      groupId,
      MlsUpdateCadence.startedAt(this.clock(), keyEpoch, this.random()),
    );
  }
}
