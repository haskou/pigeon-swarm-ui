import type { MlsTakenCommitsPrimitives } from '../../domain/MlsTakenCommitsPrimitives';
import type { MlsStateStore } from './MlsStateStore';

import { MlsTakenCommits } from '../../domain/MlsTakenCommits';

/**
 * The commits each MLS group this device holds took, sealed in the device's
 * MLS state store next to the group state, which is saved after it. A
 * record that is unreadable, or kept for another epoch than the stored
 * group's, as one a crash left behind between the two saves, knows no
 * commit.
 */
export class MlsTakenCommitsStore {
  private static key(groupId: string): string {
    return `${groupId}#taken`;
  }

  public constructor(
    private readonly store: Pick<MlsStateStore, 'loadGroup' | 'saveGroup'>,
  ) {}

  /** What the group, now in `epoch`, took. */
  public async of(groupId: string, epoch: bigint): Promise<MlsTakenCommits> {
    const bytes = await this.store.loadGroup(MlsTakenCommitsStore.key(groupId));

    if (!bytes?.length) return MlsTakenCommits.none(epoch);

    try {
      const taken = MlsTakenCommits.fromPrimitives(
        JSON.parse(
          new TextDecoder().decode(bytes),
        ) as MlsTakenCommitsPrimitives,
      );

      return taken.epoch === epoch ? taken : MlsTakenCommits.none(epoch);
    } catch {
      return MlsTakenCommits.none(epoch);
    }
  }

  public async save(groupId: string, taken: MlsTakenCommits): Promise<void> {
    await this.store.saveGroup(
      MlsTakenCommitsStore.key(groupId),
      new TextEncoder().encode(JSON.stringify(taken.toPrimitives())),
    );
  }

  /** Forgets what the group took, once this device left it. */
  public async forget(groupId: string): Promise<void> {
    const key = MlsTakenCommitsStore.key(groupId);

    if ((await this.store.loadGroup(key))?.length) {
      await this.store.saveGroup(key, new Uint8Array());
    }
  }
}
