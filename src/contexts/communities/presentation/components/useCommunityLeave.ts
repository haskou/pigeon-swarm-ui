import { useState } from 'react';

import type {
  Community,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

type UseCommunityLeaveInput = {
  community: Community;
  onBeforeLeft: () => void;
  onCommunityLeft: (community: Community) => void;
  onSessionUpdated: (session: Session) => void;
  session: Session;
};

type UseCommunityLeaveResult = {
  error: string | null;
  leave: () => Promise<void>;
  leaving: boolean;
};

export function useCommunityLeave({
  community,
  onBeforeLeft,
  onCommunityLeft,
  onSessionUpdated,
  session,
}: UseCommunityLeaveInput): UseCommunityLeaveResult {
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const leave = async () => {
    if (leaving) return;

    if (!window.confirm(copy.communities.leaveConfirm)) return;

    setLeaving(true);
    setError(null);

    try {
      const result = await applicationContainer.communities.leave(
        session,
        community.id,
      );

      onSessionUpdated({
        ...session,
        keychain: result.keychain,
        keychainExternalIdentifier: result.keychainExternalIdentifier,
      });
      onBeforeLeft();
      onCommunityLeft(result.community ?? community);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.leaveError));
    } finally {
      setLeaving(false);
    }
  };

  return { error, leave, leaving };
}
