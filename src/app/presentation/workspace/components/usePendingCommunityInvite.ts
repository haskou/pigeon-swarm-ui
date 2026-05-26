import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

import type { PendingCommunityInviteLink } from '../../../../modules/communities/presentation/view-models/communityInviteLink';
import type {
  Community,
  CommunityInviteLinkResource,
  ConversationKeyEntry,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../composition/applicationContainer';
import { decryptCommunityInviteKey } from '../../../../modules/communities/infrastructure/crypto/communityInviteKeyEnvelope';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

export function usePendingCommunityInvite({
  onPendingCommunityInviteHandled,
  pendingCommunityInvite,
  session,
  setActiveCommunityId,
  setCommunities,
  setSendError,
  setSession,
  setWorkspaceMode,
}: {
  onPendingCommunityInviteHandled?: () => void;
  pendingCommunityInvite?: PendingCommunityInviteLink | null;
  session: Session;
  setActiveCommunityId: (communityId: string) => void;
  setCommunities: Dispatch<SetStateAction<Community[]>>;
  setSendError: (error: string | null) => void;
  setSession: (session: Session | null) => void;
  setWorkspaceMode: (mode: 'community' | 'messages') => void;
}) {
  const pendingCommunityInviteRef = useRef<string | null>(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!pendingCommunityInvite) return;

    if (pendingCommunityInviteRef.current === pendingCommunityInvite.token) {
      return;
    }

    pendingCommunityInviteRef.current = pendingCommunityInvite.token;
    setSendError(null);
    void (async () => {
      const invite = await applicationContainer.getCommunityInviteLink(
        pendingCommunityInvite.token,
      );
      const keyEntry = await communityInviteKeyEntry(
        invite,
        pendingCommunityInvite.inviteSecret,
      );

      if (!keyEntry && invite.encryptedCommunityKey) {
        throw new Error(copy.communities.linkKeyMissing);
      }

      let nextSession = sessionRef.current;
      let acceptedCommunity: Community;

      if (keyEntry) {
        const accepted =
          await applicationContainer.acceptCommunityInviteLinkWithKey(
            nextSession,
            pendingCommunityInvite.token,
            keyEntry,
          );

        acceptedCommunity = accepted.community;
        nextSession = {
          ...nextSession,
          keychain: accepted.keychain,
          keychainExternalIdentifier: accepted.keychainExternalIdentifier,
        };
      } else {
        acceptedCommunity = await applicationContainer.acceptCommunityInviteLink(
          nextSession,
          pendingCommunityInvite.token,
        );
      }

      setSession(nextSession);

      setCommunities((current) => [
        acceptedCommunity,
        ...current.filter((community) => community.id !== acceptedCommunity.id),
      ]);
      setActiveCommunityId(acceptedCommunity.id);
      setWorkspaceMode('community');
      onPendingCommunityInviteHandled?.();
    })().catch((caught) => {
      pendingCommunityInviteRef.current = null;
      setSendError(toUserErrorMessage(caught, copy.communities.memberError));
    });
  }, [
    onPendingCommunityInviteHandled,
    pendingCommunityInvite,
    setActiveCommunityId,
    setCommunities,
    setSendError,
    setSession,
    setWorkspaceMode,
  ]);
}

async function communityInviteKeyEntry(
  invite: CommunityInviteLinkResource,
  inviteSecret?: string,
): Promise<ConversationKeyEntry | undefined> {
  if (!inviteSecret) return undefined;

  if (!invite.encryptedCommunityKey) return undefined;

  return await decryptCommunityInviteKey(
    invite.encryptedCommunityKey,
    inviteSecret,
  );
}
