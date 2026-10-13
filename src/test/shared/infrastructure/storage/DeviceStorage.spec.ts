import { describe, expect, it } from '@jest/globals';
import { mock, type MockProxy } from 'jest-mock-extended';

import { DeviceStorage } from '../../../../shared/infrastructure/storage/DeviceStorage';
import { DeviceStorageEstimate } from '../../../../shared/infrastructure/storage/DeviceStorageEstimate';

const MIB = 1024 * 1024;

function manager(persisted: boolean): MockProxy<StorageManager> {
  const storage = mock<StorageManager>();

  storage.persisted.mockResolvedValue(persisted);
  storage.persist.mockResolvedValue(true);

  return storage;
}

describe(DeviceStorage.name, () => {
  it('asks the browser to keep site data when it is not yet persistent', async () => {
    const storage = manager(false);

    await new DeviceStorage(storage).protect();

    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again once site data is persistent', async () => {
    const storage = manager(true);

    await new DeviceStorage(storage).protect();

    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('protects quietly when the browser refuses or lacks the API', async () => {
    const storage = manager(false);

    storage.persist.mockRejectedValue(new Error('denied'));

    await expect(new DeviceStorage(storage).protect()).resolves.toBeUndefined();
    await expect(
      new DeviceStorage(undefined).protect(),
    ).resolves.toBeUndefined();
  });

  it('estimates usage, quota and persistence', async () => {
    const storage = manager(true);

    storage.estimate.mockResolvedValue({ quota: 1000 * MIB, usage: 10 * MIB });

    expect(await new DeviceStorage(storage).estimate()).toEqual(
      new DeviceStorageEstimate(10 * MIB, 1000 * MIB, true),
    );
  });

  it('has no estimate when the browser cannot give one', async () => {
    const storage = manager(false);

    storage.estimate.mockRejectedValue(new Error('unavailable'));

    expect(await new DeviceStorage(storage).estimate()).toBeNull();
    expect(await new DeviceStorage(undefined).estimate()).toBeNull();
  });
});

describe(DeviceStorageEstimate.name, () => {
  it('is low when little free space is left', () => {
    expect(new DeviceStorageEstimate(170 * MIB, 200 * MIB, true).low).toBe(
      true,
    );
  });

  it('is low when nearly the whole quota is used', () => {
    expect(
      new DeviceStorageEstimate(9 * 1024 * MIB, 10 * 1024 * MIB, true).low,
    ).toBe(true);
  });

  it('is not low with room to spare', () => {
    expect(new DeviceStorageEstimate(10 * MIB, 1024 * MIB, false).low).toBe(
      false,
    );
  });
});
