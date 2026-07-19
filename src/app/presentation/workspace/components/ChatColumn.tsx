import type { MouseEvent } from 'react';

import { useEffect, useMemo, useState } from 'react';

import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { ChatColumnProps } from './ChatColumnProps';
import type { ChatProfileViewer } from './ChatProfileViewer';

import { identityDisplayName } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import {
  profileAnchorFromTarget,
  type ProfilePopoverAnchor,
} from '../../../../contexts/identities/presentation/view-models/profilePopoverAnchor';
import { InvitationKeyPrompt } from '../../../../contexts/notifications/presentation/components/InvitationKeyPrompt';
import { useDesktopInputFocus } from '../../../../shared/presentation/components/useDesktopInputFocus';
import { ChatColumnContent } from './ChatColumnContent';
import { ChatColumnDialogs } from './ChatColumnDialogs';
import { ChatConversationHeader } from './ChatConversationHeader';
import { ChatConversationPresentation } from './ChatConversationPresentation';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { useConversationKeyDialog } from './useConversationKeyDialog';
import { useConversationPolls } from './useConversationPolls';
import { useGroupInvitationDialog } from './useGroupInvitationDialog';

function withCurrentIdentityName(
  identityNames: Record<string, string>,
  identityId: string,
  profileName: string,
): Record<string, string> {
  return {
    ...identityNames,
    [identityId]: profileName.trim() || identityNames[identityId] || identityId,
  };
}

function hasPendingConversationInvitation(
  hasConversationKey: boolean,
  pendingInvitation: ChatColumnProps['pendingInvitation'],
  onInvitationAccept: ChatColumnProps['onInvitationAccept'],
): boolean {
  return !hasConversationKey && !!pendingInvitation && !!onInvitationAccept;
}

function ConversationInvitationPrompt({
  conversationKeyDialog,
  hasConversationKey,
  invitationAccepting,
  invitationError,
  invitationInviterName,
  onInvitationAccept,
  pendingInvitation,
}: Pick<
  ChatColumnProps,
  | 'hasConversationKey'
  | 'invitationAccepting'
  | 'invitationError'
  | 'invitationInviterName'
  | 'onInvitationAccept'
  | 'pendingInvitation'
> & {
  conversationKeyDialog: ReturnType<typeof useConversationKeyDialog>;
}) {
  if (hasConversationKey || !pendingInvitation || !onInvitationAccept) {
    return null;
  }

  return (
    <InvitationKeyPrompt
      accepting={invitationAccepting}
      error={invitationError}
      inviterName={invitationInviterName}
      kind="conversation"
      onAccept={() => onInvitationAccept(pendingInvitation)}
      onManualImport={conversationKeyDialog.openAdd}
    />
  );
}

export function ChatColumn({
  activeConversation,
  bottomRef,
  conversationKey,
  draft,
  editingMessage,
  groupInviteRequest = 0,
  hasConversationKey,
  hasReachedMessageStart,
  identityNames,
  identityPictures,
  identityProfiles,
  invitationAccepting = false,
  invitationError,
  invitationInviterName,
  messages,
  messageState,
  newMessageCount,
  nodeNetworks,
  notificationSetting,
  onCancelEdit,
  onCancelReply,
  onConversationKeyImported,
  onCreate,
  onDraftChange,
  onEditMessage,
  onEscape,
  onInvitationAccept,
  onJumpToLatest,
  onMessageMenuOpen,
  onNotificationMuteToggle,
  onNotificationSettingsOpen,
  onOpenConversationWithIdentity,
  onOpenMessageThread,
  onOpenPins,
  onOpenSidebar,
  onReactionToggle,
  onRealtimeEventsOpen,
  onReplyReferenceClick,
  onRetryMessage,
  onScroll,
  onSend,
  onStartCall,
  onStickerSend,
  onTypingActive,
  peerIdentity,
  peerIdentityId,
  peerPicture,
  pendingInvitation,
  pinnedMessageIds,
  presenceByIdentityId = {},
  progress,
  realtimeEvent,
  realtimeStatus = 'connected',
  replyToMessage,
  scrollerRef,
  sendError,
  session,
  typingIdentityIds = [],
}: ChatColumnProps) {
  const [profileViewer, setProfileViewer] = useState<ChatProfileViewer | null>(
    null,
  );
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [conversationDataOpen, setConversationDataOpen] = useState(false);
  const [encryptionDetailsOpen, setEncryptionDetailsOpen] = useState(false);
  const reactionAuthorNames = useMemo(
    () =>
      withCurrentIdentityName(
        identityNames,
        session.identity.id,
        session.identity.profile.name,
      ),
    [identityNames, session.identity.id, session.identity.profile.name],
  );
  const [groupProfileOpen, setGroupProfileOpen] = useState(false);
  const conversationKeyDialog = useConversationKeyDialog({
    conversation: activeConversation,
    conversationKey,
    onConversationKeyImported,
    peerIdentity,
    peerIdentityId,
    session,
  });
  const canAutoFocusInput = useDesktopInputFocus();
  useEffect(
    () => () => {
      onTypingActive?.(false);
    },
    [activeConversation?.id, onTypingActive],
  );
  const conversationPresentation = useMemo(
    () =>
      new ChatConversationPresentation({
        conversation: activeConversation,
        conversationKey,
        currentIdentityId: session.identity.id,
        hasConversationKey,
        identityNames,
        identityPictures,
        identityProfiles,
        loadedMessageCount: messages.length,
        nodeNetworks,
        peerIdentity,
        peerIdentityId,
      }),
    [
      activeConversation,
      conversationKey,
      hasConversationKey,
      identityNames,
      identityPictures,
      identityProfiles,
      messages.length,
      nodeNetworks,
      peerIdentity,
      peerIdentityId,
      session.identity.id,
    ],
  );
  const isGroupConversation = conversationPresentation.isGroup;
  const groupInvitationDialog = useGroupInvitationDialog({
    conversation: activeConversation,
    enabled: isGroupConversation,
    request: groupInviteRequest,
    session,
  });
  const conversationPolls = useConversationPolls({
    conversation: activeConversation,
    realtimeEvent,
    session,
  });
  const {
    callParticipants,
    canCreatePoll,
    canOpenPeerProfile,
    canShareConversationKey,
    conversationData,
    groupParticipants,
    name: activeConversationName,
    networkId: conversationNetworkId,
    networkName: conversationNetworkName,
    networkTooltip: conversationNetworkTooltip,
    title: activeConversationTitle,
  } = conversationPresentation;
  const hasPendingInvitation = hasPendingConversationInvitation(
    hasConversationKey,
    pendingInvitation,
    onInvitationAccept,
  );
  const invitationPrompt = (
    <ConversationInvitationPrompt
      conversationKeyDialog={conversationKeyDialog}
      hasConversationKey={hasConversationKey}
      invitationAccepting={invitationAccepting}
      invitationError={invitationError}
      invitationInviterName={invitationInviterName}
      onInvitationAccept={onInvitationAccept}
      pendingInvitation={pendingInvitation}
    />
  );
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setProfileViewer(null);
      setGroupProfileOpen(false);
      setConversationMenuOpen(false);
      setConversationDataOpen(false);
      groupInvitationDialog.close();
      conversationKeyDialog.close();
    };

    window.addEventListener('keydown', handleEscape);

    return () => window.removeEventListener('keydown', handleEscape);
  }, [conversationKeyDialog.close, groupInvitationDialog.close]);
  const openOwnProfile = (anchor?: ProfilePopoverAnchor) =>
    setProfileViewer({
      anchor,
      identity: session.identity,
      identityId: session.identity.id,
      name: session.identity.profile.name,
      picture: identityPictures[session.identity.id],
    });
  const openPeerProfile = (anchor?: ProfilePopoverAnchor) => {
    if (!peerIdentityId || !activeConversationName) return;

    setProfileViewer({
      anchor,
      identity: peerIdentity,
      identityId: peerIdentityId,
      name: activeConversationName,
      picture: peerPicture,
    });
  };
  const openConversationHeader = (event?: MouseEvent<HTMLElement>) => {
    if (!activeConversation) return;

    if (isGroupConversation) {
      setGroupProfileOpen(true);

      return;
    }

    openPeerProfile(profileAnchorFromTarget(event?.currentTarget));
  };
  const openMessageAuthorProfile = (
    message: ChatMessage,
    anchor?: ProfilePopoverAnchor,
  ) => {
    if (message.mine || message.authorIdentityId === session.identity.id) {
      openOwnProfile(anchor);

      return;
    }

    setProfileViewer({
      anchor,
      identity: identityProfiles[message.authorIdentityId],
      identityId: message.authorIdentityId,
      name: identityDisplayName(message.authorIdentityId, identityNames),
      picture: identityPictures[message.authorIdentityId],
    });
  };

  return (
    <section className="app-safe-area-panel glass-panel-strong flex min-h-0 flex-col overflow-hidden rounded-none">
      <ChatConversationHeader
        activeConversation={activeConversation}
        activeConversationName={activeConversationName}
        activeConversationTitle={activeConversationTitle}
        canOpenPeerProfile={canOpenPeerProfile}
        conversationNetworkName={conversationNetworkName}
        conversationNetworkTooltip={conversationNetworkTooltip}
        hasConversationKey={hasConversationKey}
        isGroupConversation={isGroupConversation}
        menuOpen={conversationMenuOpen}
        onConversationOpen={openConversationHeader}
        onMenuToggle={() => setConversationMenuOpen((isOpen) => !isOpen)}
        onEncryptionDetailsOpen={() => setEncryptionDetailsOpen(true)}
        onOpenSidebar={onOpenSidebar}
        onPinsOpen={onOpenPins}
        onRealtimeEventsOpen={onRealtimeEventsOpen}
        peerPicture={peerPicture}
        peerPresence={
          peerIdentityId ? presenceByIdentityId[peerIdentityId] : undefined
        }
        realtimeStatus={realtimeStatus}
      >
        {conversationMenuOpen && activeConversation && (
          <ConversationActionsMenu
            activeConversation={activeConversation}
            activeConversationName={activeConversationName}
            activeConversationTitle={activeConversationTitle}
            callParticipants={callParticipants}
            canShareConversationKey={canShareConversationKey}
            hasConversationKey={hasConversationKey}
            isGroupConversation={isGroupConversation}
            notificationSetting={notificationSetting}
            onClose={() => setConversationMenuOpen(false)}
            onConversationDataOpen={() => setConversationDataOpen(true)}
            onConversationKeyOpen={() => {
              if (hasConversationKey) {
                conversationKeyDialog.openCopy();
              } else {
                conversationKeyDialog.openAdd();
              }
            }}
            onGroupInviteOpen={() => {
              groupInvitationDialog.show();
            }}
            onNotificationMuteToggle={() =>
              onNotificationMuteToggle(notificationSetting.scope)
            }
            onNotificationSettingsOpen={() =>
              onNotificationSettingsOpen({
                scope: notificationSetting.scope,
                subtitle: conversationNetworkName,
                title: activeConversationTitle ?? activeConversation.id,
              })
            }
            onOpenPins={onOpenPins}
            onRealtimeEventsOpen={onRealtimeEventsOpen}
            onStartCall={onStartCall}
          />
        )}
      </ChatConversationHeader>

      <ChatColumnContent
        activeConversation={activeConversation}
        bottomRef={bottomRef}
        canCreatePoll={canCreatePoll}
        draft={draft}
        editingMessage={editingMessage}
        hasConversationKey={hasConversationKey}
        hasPendingInvitation={hasPendingInvitation}
        hasReachedMessageStart={hasReachedMessageStart}
        identityNames={identityNames}
        identityPictures={identityPictures}
        invitationPrompt={invitationPrompt}
        isGroupConversation={isGroupConversation}
        messageState={messageState}
        messages={messages}
        newMessageCount={newMessageCount}
        onCancelEdit={onCancelEdit}
        onCancelReply={onCancelReply}
        onCreate={onCreate}
        onDraftChange={onDraftChange}
        onEditMessage={onEditMessage}
        onEscape={onEscape}
        onJumpToLatest={onJumpToLatest}
        onMessageAuthorProfileOpen={(message, target) =>
          openMessageAuthorProfile(message, profileAnchorFromTarget(target))
        }
        onMessageMenuOpen={onMessageMenuOpen}
        onOpenMessageThread={onOpenMessageThread}
        onReactionToggle={onReactionToggle}
        onReplyReferenceClick={onReplyReferenceClick}
        onRetryMessage={onRetryMessage}
        onScroll={onScroll}
        onSend={onSend}
        onStickerSend={onStickerSend}
        onTypingActive={onTypingActive}
        pinnedMessageIds={pinnedMessageIds}
        polls={conversationPolls}
        progress={progress}
        reactionAuthorNames={reactionAuthorNames}
        replyToMessage={replyToMessage}
        scrollerRef={scrollerRef}
        sendError={sendError}
        session={session}
        typingIdentityIds={typingIdentityIds}
      />
      <ChatColumnDialogs
        activeConversation={activeConversation}
        autoFocus={canAutoFocusInput}
        conversationData={conversationData}
        conversationDataOpen={conversationDataOpen}
        conversationKeyDialog={conversationKeyDialog}
        encryptionDetails={conversationPresentation.encryptionDetails}
        encryptionDetailsOpen={encryptionDetailsOpen}
        groupInvitationDialog={groupInvitationDialog}
        groupParticipants={groupParticipants}
        groupProfileOpen={groupProfileOpen}
        networkId={conversationNetworkId}
        nodeNetworks={nodeNetworks}
        onConversationDataClose={() => setConversationDataOpen(false)}
        onEncryptionDetailsClose={() => setEncryptionDetailsOpen(false)}
        onGroupProfileClose={() => setGroupProfileOpen(false)}
        onOpenConversationWithIdentity={onOpenConversationWithIdentity}
        presenceByIdentityId={presenceByIdentityId}
        profileViewer={profileViewer}
        session={session}
        setProfileViewer={setProfileViewer}
      />
    </section>
  );
}
