import { useEffect } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  applicationContainer,
  deviceStorage,
} from '../../../composition/applicationContainer';

type DeviceStorageNoticeInput = {
  onNoticeChange: (notice: string) => void;
  session: Session;
};

/**
 * Once per unlock: asks the browser quietly to keep the site's data, then
 * shows one notice when this device dropped its stored direct history or runs
 * low on space. Says nothing otherwise.
 */
export function useDeviceStorageNotice({
  onNoticeChange,
  session,
}: DeviceStorageNoticeInput): void {
  const identityId = session.identity.id;

  useEffect(() => {
    let live = true;

    const check = async (): Promise<void> => {
      await deviceStorage.protect();

      if (
        await applicationContainer.directMessages.checkHistoryDropped(session)
      ) {
        if (live) onNoticeChange(copy.workspace.deviceStorageLost);

        return;
      }

      const estimate = await deviceStorage.estimate();

      if (live && estimate?.low)
        onNoticeChange(copy.workspace.deviceStorageLow);
    };

    void check();

    return () => {
      live = false;
    };
    // One check per unlocked identity; a refreshed session is the same unlock.
  }, [identityId, onNoticeChange]);
}
