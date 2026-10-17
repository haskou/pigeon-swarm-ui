import { scopeClientStorageKey } from '../../../../shared/infrastructure/storage/ClientStorageScope';
import {
  readJsonObjectFromLocalStorage,
  writeJsonToLocalStorage,
} from '../../../../shared/infrastructure/storage/jsonLocalStorage';
import { DeviceHistoryFloor } from '../../domain/value-objects/DeviceHistoryFloor';

/**
 * The history floor this device was paired with, per identity. A device that
 * was never paired, or whose stored floor is unreadable, keeps every record.
 * A saved floor also holds in memory, so a write the browser refuses still
 * applies for the rest of the app session.
 */
export class DeviceHistoryFloorStore {
  private readonly floors = new Map<string, DeviceHistoryFloor>();

  public static storageKey(identityId: string): string {
    return scopeClientStorageKey(`pigeon:historyFloor:${identityId}`);
  }

  public load(identityId: string): DeviceHistoryFloor {
    const held = this.floors.get(identityId);

    if (held) return held;

    const { floor } = readJsonObjectFromLocalStorage<{ floor?: unknown }>(
      DeviceHistoryFloorStore.storageKey(identityId),
      {},
    );

    return typeof floor === 'number' &&
      Number.isSafeInteger(floor) &&
      floor >= 0
      ? DeviceHistoryFloor.fromPrimitives(floor)
      : DeviceHistoryFloor.OPEN;
  }

  public save(identityId: string, floor: DeviceHistoryFloor): void {
    this.floors.set(identityId, floor);
    writeJsonToLocalStorage(DeviceHistoryFloorStore.storageKey(identityId), {
      floor: floor.toPrimitives(),
    });
  }
}
