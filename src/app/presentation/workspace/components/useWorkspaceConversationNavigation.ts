import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { NullObject } from '@haskou/value-objects';
import { useCallback } from 'react';

import type {
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { applicationContainer } from '../../../composition/applicationContainer';
import { applyPublishedKeychain } from './applyPublishedKeychain';
import { WorkspaceConversationTarget } from './WorkspaceConversationTarget';

type WorkspaceConversationNavigationInput = {
  closeCommunityMembers: () => void;
  closeConversationCreation: () => void;
  closeSidebar: () => void;
  conversations: ConversationResource[];
  rememberIdentity: (identity: IdentityResource) => void;
  session: Session;
  sessionRef: MutableRefObject<Session>;
  setActiveConversationId: Dispatch<SetStateAction<null | string>>;
  setConversations: Dispatch<SetStateAction<ConversationResource[]>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  showMessagesWorkspace: () => void;
};

type WorkspaceConversationNavigation = {
  importConversationKey: (keyEntry: ConversationKeyEntry) => Promise<void>;
  openCreatedConversation: (
    session: Session,
    conversation: ConversationResource,
  ) => void;
  openOrCreateConversation: (
    identityId: string,
    identity?: IdentityResource,
    preferredNetworkId?: string,
  ) => Promise<void>;
};

export function useWorkspaceConversationNavigation({
  closeCommunityMembers,
  closeConversationCreation,
  closeSidebar,
  conversations,
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
        ConversationTimeline.sortByLatestMessage([
          conversation,
          ...current.filter((item) => item.id !== conversation.id),
        ]),
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
      if (identityId === session.identity.id) return;

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
        session.identity.networks,
        identity,
        preferredNetworkId,
      );

      if (NullObject.isNullObject(sharedNetwork)) {
        throw new Error(copy.dialog.noSharedNetwork);
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
        ConversationTimeline.sortByLatestMessage([
          result.conversation,
          ...current.filter((item) => item.id !== result.conversation.id),
        ]),
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
        {
          ...session.keychain,
          conversations: {
            ...session.keychain.conversations,
            [keyEntry.conversationId]: keyEntry,
          },
        },
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
