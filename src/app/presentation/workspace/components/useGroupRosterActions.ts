import { useCallback, useState } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { GroupRosterPermissions } from './GroupRosterPermissions';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';

export interface GroupRosterActionsController {
  demoteAdmin: (identityId: string) => Promise<void>;
  error: string | null;
  leave: () => Promise<void>;
  pending: boolean;
  promoteAdmin: (identityId: string) => Promise<void>;
  removeParticipant: (identityId: string) => Promise<void>;
}

// Mirrors the node's roster rules: the creator is never an admin and never
// leaves; the creator and admins manage members; only the creator removes
// admins and manages the admin set.
export function groupRosterPermissions(
  conversation: ConversationResource | undefined,
  actorIdentityId: string,
): GroupRosterPermissions {
  const isGroup = conversation?.type === 'group';
  const creatorId = conversation?.creatorId;
  const adminIds = conversation?.adminIds ?? [];
  const actorIsCreator = isGroup && creatorId === actorIdentityId;
  const actorIsAdmin = isGroup && adminIds.includes(actorIdentityId);
  const isMember = (identityId: string): boolean =>
    conversation?.participantIds.includes(identityId) ?? false;

  return {
    canDemote: (identityId) => actorIsCreator && adminIds.includes(identityId),
    canLeave: isGroup && !actorIsCreator && isMember(actorIdentityId),
    canPromote: (identityId) =>
      actorIsCreator &&
      isMember(identityId) &&
      identityId !== creatorId &&
      !adminIds.includes(identityId),
    canRemove: (identityId) =>
      isMember(identityId) &&
      identityId !== actorIdentityId &&
      identityId !== creatorId &&
      (actorIsCreator || (actorIsAdmin && !adminIds.includes(identityId))),
  };
}

export function useGroupRosterActions({
  conversation,
  onRosterChanged,
  session,
}: {
  conversation?: ConversationResource;
  onRosterChanged: () => Promise<unknown>;
  session: Session;
}): GroupRosterActionsController {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (
      action: (conversationId: string) => Promise<ConversationResource>,
    ): Promise<void> => {
      if (!conversation || pending) return;

      setPending(true);
      setError(null);
      try {
        await action(conversation.id);
        await onRosterChanged();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : copy.chat.rosterError,
        );
      } finally {
        setPending(false);
      }
    },
    [conversation, onRosterChanged, pending],
  );

  return {
    demoteAdmin: (identityId) =>
      run((id) =>
        applicationContainer.conversations.demoteAdmin(session, id, identityId),
      ),
    error,
    leave: () =>
      run((id) => applicationContainer.conversations.leave(session, id)),
    pending,
    promoteAdmin: (identityId) =>
      run((id) =>
        applicationContainer.conversations.promoteAdmin(
          session,
          id,
          identityId,
        ),
      ),
    removeParticipant: (identityId) =>
      run((id) =>
        applicationContainer.conversations.removeParticipant(
          session,
          id,
          identityId,
        ),
      ),
  };
}
