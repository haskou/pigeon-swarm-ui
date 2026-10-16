import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import {
  applicationContainer,
  deviceStorage,
} from '../../../../../app/composition/applicationContainer';
import { useDeviceStorageNotice } from '../../../../../app/presentation/workspace/components/useDeviceStorageNotice';
import { DeviceStorageEstimate } from '../../../../../shared/infrastructure/storage/DeviceStorageEstimate';
import { copy } from '../../../../../shared/presentation/i18n/copy';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];
const MIB = 1024 * 1024;

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    directMessages: { checkHistoryDropped: jest.fn() },
    groupMessages: { checkHistoryDropped: jest.fn() },
  },
  deviceStorage: { estimate: jest.fn(), protect: jest.fn() },
}));

const directMessages = jest.mocked(applicationContainer.directMessages);
const groupMessages = jest.mocked(applicationContainer.groupMessages);
const storage = jest.mocked(deviceStorage);
const session = { identity: { id: 'identity-1' } } as unknown as Session;

async function settle(): Promise<void> {
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
}

function mount(): { cleanup: () => void; onNoticeChange: jest.Mock } {
  const onNoticeChange = jest.fn();

  mockEffects.length = 0;
  useDeviceStorageNotice({ onNoticeChange, session });

  const cleanups = mockEffects.map((effect) => effect());

  return {
    cleanup: () => cleanups.forEach((cleanup) => cleanup?.()),
    onNoticeChange,
  };
}

describe(useDeviceStorageNotice.name, () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.protect.mockResolvedValue(undefined);
    storage.estimate.mockResolvedValue(
      new DeviceStorageEstimate(10 * MIB, 1024 * MIB, true),
    );
    directMessages.checkHistoryDropped.mockResolvedValue(false);
    groupMessages.checkHistoryDropped.mockResolvedValue(false);
  });

  it('asks for persistent storage after unlock and stays quiet with room to spare', async () => {
    const { onNoticeChange } = mount();

    await settle();

    expect(storage.protect).toHaveBeenCalledTimes(1);
    expect(directMessages.checkHistoryDropped).toHaveBeenCalledWith(session);
    expect(groupMessages.checkHistoryDropped).toHaveBeenCalledWith(session);
    expect(onNoticeChange).not.toHaveBeenCalled();
  });

  it('says so when this device dropped its stored history', async () => {
    directMessages.checkHistoryDropped.mockResolvedValue(true);

    const { onNoticeChange } = mount();

    await settle();

    expect(onNoticeChange).toHaveBeenCalledTimes(1);
    expect(onNoticeChange).toHaveBeenCalledWith(
      copy.workspace.deviceStorageLost,
    );
  });

  it('says so once when this device dropped its stored group history', async () => {
    groupMessages.checkHistoryDropped.mockResolvedValue(true);

    const { onNoticeChange } = mount();

    await settle();

    expect(onNoticeChange).toHaveBeenCalledTimes(1);
    expect(onNoticeChange).toHaveBeenCalledWith(
      copy.workspace.deviceStorageLost,
    );
    expect(storage.estimate).not.toHaveBeenCalled();
  });

  it('takes both drops into one notice, so neither shows on a later unlock', async () => {
    directMessages.checkHistoryDropped.mockResolvedValue(true);
    groupMessages.checkHistoryDropped.mockResolvedValue(true);

    const { onNoticeChange } = mount();

    await settle();

    expect(groupMessages.checkHistoryDropped).toHaveBeenCalledWith(session);
    expect(onNoticeChange).toHaveBeenCalledTimes(1);
  });

  it('warns once when space on this device runs low', async () => {
    storage.estimate.mockResolvedValue(
      new DeviceStorageEstimate(190 * MIB, 200 * MIB, false),
    );

    const { onNoticeChange } = mount();

    await settle();

    expect(onNoticeChange).toHaveBeenCalledTimes(1);
    expect(onNoticeChange).toHaveBeenCalledWith(
      copy.workspace.deviceStorageLow,
    );
  });

  it('shows nothing once the workspace is gone', async () => {
    directMessages.checkHistoryDropped.mockResolvedValue(true);

    const { cleanup, onNoticeChange } = mount();

    cleanup();
    await settle();

    expect(onNoticeChange).not.toHaveBeenCalled();
  });
});
