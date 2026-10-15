import { useEffect, useState } from 'react';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CommunityEncryptionState } from '../view-models/CommunityChannelEncryption';

import { applicationContainer } from '../../../../app/composition/applicationContainer';

const refreshIntervalMs = 30_000;

/**
 * Keeps this device in the community's MLS groups and reports whether it can
 * read the group of the shown channel: the community group, or the channel's
 * own group when only some roles may see it. Without a channel it only keeps
 * the groups current. Public communities are not encrypted.
 */
export function useCommunityEncryption({
  channelId,
  communityId,
  isPublic,
  memberKey,
  session,
}: {
  channelId: string | null;
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
      if (channelId === null) {
        applicationContainer.mls
          .synchronize(session, communityId)
          .catch(() => undefined);

        return;
      }

      applicationContainer.mls
        .ready(session, communityId, channelId)
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
  }, [channelId, communityId, isPublic, memberKey, session]);

  return isPublic ? 'public' : state;
}
