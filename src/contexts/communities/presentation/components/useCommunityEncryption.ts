import { useEffect, useState } from 'react';

import type { CommunityEncryptionState } from '../view-models/CommunityChannelEncryption';

import type { Session } from '../../../../shared/domain/pigeonResources.types';
import { applicationContainer } from '../../../../app/composition/applicationContainer';

const refreshIntervalMs = 30_000;

/**
 * Keeps this device in the community's MLS group and reports whether it can
 * read it. Public communities are not encrypted.
 */
export function useCommunityEncryption({
  communityId,
  isPublic,
  memberKey,
  session,
}: {
  communityId: string;
  isPublic: boolean;
  memberKey: string;
  session: Session;
}): CommunityEncryptionState {
  const [state, setState] = useState<CommunityEncryptionState>('checking');

  useEffect(() => {
    if (isPublic) return undefined;

    let active = true;
    const refresh = () => {
      applicationContainer.mls
        .synchronize(session, communityId)
        .then((ready) => active && setState(ready ? 'ready' : 'pending'))
        .catch(() => active && setState('pending'));
    };

    setState('checking');
    refresh();

    const timer = window.setInterval(refresh, refreshIntervalMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
    // `memberKey` re-runs the reconciliation when the roster changes.
  }, [communityId, isPublic, memberKey, session]);

  return isPublic ? 'public' : state;
}
