import { Timestamp } from '@haskou/value-objects';

import { DeviceHistoryFloor } from '../../../../../contexts/identities/domain/value-objects/DeviceHistoryFloor';
import { DeviceHistoryFloorStore } from '../../../../../contexts/identities/infrastructure/storage/DeviceHistoryFloorStore';

describe('DeviceHistoryFloorStore', () => {
  const storage = new Map<string, string>();
  let refuseWrites = false;

  beforeEach(() => {
    storage.clear();
    refuseWrites = false;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => {
          if (refuseWrites) throw new Error('QuotaExceededError');

          storage.set(key, value);
        },
      },
    });
  });

  it('keeps every record on a device that was never paired', () => {
    expect(new DeviceHistoryFloorStore().load('identity-1')).toBe(
      DeviceHistoryFloor.OPEN,
    );
  });

  it('keeps the floor of each identity across a reload', () => {
    new DeviceHistoryFloorStore().save(
      'identity-1',
      DeviceHistoryFloor.at(new Timestamp(900)),
    );

    const reloaded = new DeviceHistoryFloorStore();

    expect(reloaded.load('identity-1').toPrimitives()).toBe(900);
    expect(reloaded.load('identity-2')).toBe(DeviceHistoryFloor.OPEN);
  });

  it.each(['{not json', '{"floor":-1}', '{"floor":1.5}', '{"floor":"900"}'])(
    'treats an unreadable stored floor %s as no floor',
    (stored) => {
      storage.set(DeviceHistoryFloorStore.storageKey('identity-1'), stored);

      expect(new DeviceHistoryFloorStore().load('identity-1')).toBe(
        DeviceHistoryFloor.OPEN,
      );
    },
  );

  it('still applies a floor the browser refused to store for the rest of the session', () => {
    refuseWrites = true;
    const store = new DeviceHistoryFloorStore();

    store.save('identity-1', DeviceHistoryFloor.at(new Timestamp(900)));

    expect(store.load('identity-1').toPrimitives()).toBe(900);
  });
});
