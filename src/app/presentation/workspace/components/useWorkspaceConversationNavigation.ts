import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { NullObject } from '@haskou/value-objects';
import { useCallback } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { ConversationKeyEntry } from '../../../../contexts/identities/infrastructure/keychain/ConversationKeyEntry';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { NodeNetwork } from '../../../../contexts/networks/presentation/view-models/NodeNetwork';
import type { WorkspaceConversationNavigation } from './WorkspaceConversationNavigation';

import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { IdentityMatch } from '../../../../contexts/identities/domain/IdentityMatch';
import { allowedNetworkIds } from '../../../../contexts/networks/presentation/view-models/nodeNetworkVisibility';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { applyPublishedKeychain } from './applyPublishedKeychain';
import { WorkspaceConversationTarget } from './WorkspaceConversationTarget';

function sortWithConversationFirst(
  conversations: ConversationResource[],
  conversation: ConversationResource,
): ConversationResource[] {
  return ConversationTimeline.sortByLatestMessage([
    conversation,
    ...conversations.filter((item) => item.id !== conversation.id),
  ]);
}

type WorkspaceConversationNavigationInput = {
  closeCommunityMembers: () => void;
  closeConversationCreation: () => void;
  closeSidebar: () => void;
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  nodeNetworksLoading: boolean;
  nodeNetworksLoadError: boolean;
  rememberIdentity: (identity: IdentityResource) => void;
  session: Session;
  sessionRef: MutableRefObject<Session>;
  setActiveConversationId: Dispatch<SetStateAction<null | string>>;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  showMessagesWorkspace: () => void;
};

export function useWorkspaceConversationNavigation({
  closeCommunityMembers,
  closeConversationCreation,
  closeSidebar,
  conversations,
  nodeNetworks,
  nodeNetworksLoadError,
  nodeNetworksLoading,
  rememberIdentity,
  session,
  sessionRef,
  setActiveConversationId,
  setConversations,
  setSession,
  showMessagesWorkspace,
}: WorkspaceConversationNavigationInput): WorkspaceConversationNavigation {
  const openCreatedConversation = useCallback(
    (nextSession: Session, conversation: ConversationResource): void => {
      setSession((current) =>
        applyPublishedKeychain(current, nextSession.identity.id, nextSession),
      );
      setConversations((current) =>
        sortWithConversationFirst(current, conversation),
      );
      setActiveConversationId(conversation.id);
      closeConversationCreation();
      closeSidebar();
    },
    [
      closeConversationCreation,
      closeSidebar,
      setActiveConversationId,
      setConversations,
      setSession,
    ],
  );
  const openOrCreateConversation = useCallback(
    async (
      identityId: string,
      identity?: IdentityResource,
      preferredNetworkId?: string,
    ): Promise<void> => {
      if (IdentityMatch.isSame(identityId, session.identity.id)) return;

      const existingConversation =
        WorkspaceConversationTarget.existingConversation(
          conversations,
          session.identity.id,
          session.keychain,
          identityId,
        );

      if (existingConversation) {
        showMessagesWorkspace();
        setActiveConversationId(existingConversation.id);
        closeSidebar();
        closeCommunityMembers();

        return;
      }

      const sharedNetwork = WorkspaceConversationTarget.sharedNetwork(
        allowedNetworkIds({
          networkIds: session.identity.networks,
          nodeNetworks,
          privateOnly: true,
        }),
        identity,
        preferredNetworkId,
      );

      if (NullObject.isNullObject(sharedNetwork)) {
        throw new Error(
          nodeNetworksLoadError
            ? copy.nodeSettings.error
            : nodeNetworksLoading
              ? copy.dialog.networksLoading
              : copy.dialog.noSharedPrivateNetwork,
        );
      }

      const publishingSession = sessionRef.current;
      const result = await applicationContainer.conversations.create(
        publishingSession,
        identityId,
        sharedNetwork.toString(),
      );

      setSession((current) =>
        applyPublishedKeychain(current, publishingSession.identity.id, result),
      );

      if (identity) rememberIdentity(identity);
      setConversations((current) =>
        sortWithConversationFirst(current, result.conversation),
      );
      showMessagesWorkspace();
      setActiveConversationId(result.conversation.id);
      closeSidebar();
      closeCommunityMembers();
    },
    [
      closeCommunityMembers,
      closeSidebar,
      conversations,
      nodeNetworks,
      nodeNetworksLoading,
      nodeNetworksLoadError,
      rememberIdentity,
      session.identity.id,
      session.identity.networks,
      session.keychain,
      sessionRef,
      setActiveConversationId,
      setConversations,
      setSession,
      showMessagesWorkspace,
    ],
  );
  const importConversationKey = useCallback(
    async (keyEntry: ConversationKeyEntry): Promise<void> => {
      const result = await applicationContainer.identities.publishKeychain(
        session,
        (current) => ({
          ...current,
          conversations: {
            ...current.conversations,
            [keyEntry.conversationId]: keyEntry,
          },
        }),
      );

      setSession((current) =>
        applyPublishedKeychain(current, session.identity.id, result),
      );
    },
    [session, setSession],
  );

  return {
    importConversationKey,
    openCreatedConversation,
    openOrCreateConversation,
  };
}
