import { Suspense, type ReactElement } from 'react';

import type { ConversationResource } from '../../../../shared/domain/pigeonResources.types';
import type { MessagesWorkspaceContentProps } from './MessagesWorkspaceContentProps';
import type { useConversationThread } from './useConversationThread';

import { identityDisplayName } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { MessageThreadPanel } from '../../../../contexts/messages/presentation/components/MessageThreadPanel';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { ChatColumn } from './ChatColumn';

function ConversationThreadContent({
  activeConversation,
  activeConversationKey,
  activeConversationPeerIdentityId,
  activeThread,
  identityNames,
  identityPictures,
  messageActions,
  pins,
  session,
  thread,
  timeline,
}: MessagesWorkspaceContentProps & {
  activeConversation: ConversationResource;
  activeThread: NonNullable<ReturnType<typeof useConversationThread>['thread']>;
}): ReactElement {
  const title =
    activeConversation.title ??
    activeConversation.name ??
    (activeConversationPeerIdentityId
      ? identityNames[activeConversationPeerIdentityId]
      : undefined) ??
    activeConversation.id;
  const replyToAuthorName = activeThread.replyTarget
    ? identityDisplayName(
        activeThread.replyTarget.authorIdentityId,
        identityNames,
      )
    : undefined;

  return (
    <MessageThreadPanel
      attachmentEncryptionAvailable={Boolean(activeConversationKey)}
      currentIdentityId={session.identity.id}
      disabled={!activeConversationKey}
      draft={activeThread.draft}
      editingMessage={activeThread.editingMessage?.message ?? null}
      error={activeThread.error}
      identityNames={identityNames}
      identityPictures={identityPictures}
      messages={activeThread.messages}
      onCancelEdit={thread.cancelEditing}
      onCancelReply={thread.cancelReplying}
      onClose={() => thread.setThread(null)}
      onDraftChange={thread.updateDraft}
      onEdit={thread.edit}
      onMessageMenuOpen={messageActions.openThreadMessageMenu}
      onRootMessageOpen={(message) => {
        timeline.setMessages((current) =>
          MessageCollection.merge(current, [message]),
        );
        thread.setThread(null);
        window.setTimeout(() => messageActions.scrollToMessage(message.id), 0);
      }}
      onSend={thread.send}
      onStickerSend={thread.sendSticker}
      pinnedMessageIds={pins.pinnedMessageIds}
      replyTo={activeThread.replyTarget}
      replyToAuthorName={replyToAuthorName}
      rootMessage={activeThread.root}
      session={session}
      title={title}
    />
  );
}

function ConversationChatContent({
  acceptInvitation,
  activeConversation,
  activeConversationDraft,
  activeConversationKey,
  activeConversationPeerIdentityId,
  attachmentProgress,
  callControls,
  closeTransientUi,
  conversationNotificationSetting,
  conversationRealtimeEvent,
  conversationTypingIdentityIds,
  editingMessage,
  groupInviteRequest,
  identityNames,
  identityPictures,
  identityProfiles,
  invitationAccepting,
  invitationError,
  invitationInviterName,
  messageActions,
  nodeNetworks,
  notificationMuteToggle,
  notificationSettingsOpen,
  onConversationKeyImported,
  onCreateConversation,
  onOpenConversationWithIdentity,
  onRealtimeEventsOpen,
  onSidebarOpen,
  pendingInvitation,
  pins,
  presenceByIdentityId,
  realtimeStatus,
  replyTarget,
  sendConversationTyping,
  sendError,
  session,
  thread,
  timeline,
  updateActiveDraft,
}: MessagesWorkspaceContentProps): ReactElement {
  const peerIdentity = activeConversationPeerIdentityId
    ? identityProfiles[activeConversationPeerIdentityId]
    : undefined;
  const peerPicture = activeConversationPeerIdentityId
    ? identityPictures[activeConversationPeerIdentityId]
    : undefined;

  return (
    <Suspense fallback={null}>
      <ChatColumn
        activeConversation={activeConversation}
        bottomRef={timeline.bottomRef}
        conversationKey={activeConversationKey}
        draft={activeConversationDraft}
        editingMessage={editingMessage?.message ?? null}
        groupInviteRequest={groupInviteRequest}
        hasConversationKey={Boolean(activeConversationKey)}
        hasReachedMessageStart={!timeline.messageCursor}
        identityNames={identityNames}
        identityPictures={identityPictures}
        identityProfiles={identityProfiles}
        invitationAccepting={invitationAccepting}
        invitationError={invitationError}
        invitationInviterName={invitationInviterName}
        messageState={timeline.messageState}
        messages={timeline.messages}
        newMessageCount={timeline.newMessageCount}
        nodeNetworks={nodeNetworks}
        notificationSetting={conversationNotificationSetting}
        onCancelEdit={messageActions.cancelEdit}
        onCancelReply={messageActions.cancelReply}
        onConversationKeyImported={onConversationKeyImported}
        onCreate={onCreateConversation}
        onDraftChange={updateActiveDraft}
        onEditMessage={messageActions.editMessage}
        onEscape={closeTransientUi}
        onInvitationAccept={acceptInvitation}
        onJumpToLatest={timeline.jumpToLatestMessages}
        onMessageMenuOpen={messageActions.openMessageMenu}
        onNotificationMuteToggle={notificationMuteToggle}
        onNotificationSettingsOpen={notificationSettingsOpen}
        onOpenConversationWithIdentity={(identityId, identity) =>
          onOpenConversationWithIdentity(
            identityId,
            identity,
            activeConversation?.networkId,
          )
        }
        onOpenMessageThread={(message) => void thread.open(message)}
        onOpenPins={() => void pins.open()}
        onOpenSidebar={onSidebarOpen}
        onReactionToggle={(message, emoji, reacted) =>
          void messageActions.toggleReaction(message, emoji, reacted)
        }
        onRealtimeEventsOpen={onRealtimeEventsOpen}
        onReplyReferenceClick={(messageId) =>
          void messageActions.openReplyReference(messageId)
        }
        onRetryMessage={messageActions.retryMessage}
        onScroll={timeline.handleScroll}
        onSend={messageActions.sendMessage}
        onStartCall={callControls.startConversationCall}
        onStickerSend={messageActions.sendSticker}
        onTypingActive={sendConversationTyping}
        peerIdentity={peerIdentity}
        peerIdentityId={activeConversationPeerIdentityId}
        peerPicture={peerPicture}
        pendingInvitation={pendingInvitation}
        pinnedMessageIds={pins.pinnedMessageIds}
        presenceByIdentityId={presenceByIdentityId}
        progress={attachmentProgress}
        realtimeEvent={conversationRealtimeEvent}
        realtimeStatus={realtimeStatus}
        replyToMessage={replyTarget}
        scrollerRef={timeline.scrollerRef}
        sendError={sendError}
        session={session}
        typingIdentityIds={conversationTypingIdentityIds}
      />
    </Suspense>
  );
}

export function ConversationWorkspaceContent(
  props: MessagesWorkspaceContentProps,
): ReactElement {
  if (props.thread.thread && props.activeConversation) {
    return (
      <ConversationThreadContent
        {...props}
        activeConversation={props.activeConversation}
        activeThread={props.thread.thread}
      />
    );
  }

  return <ConversationChatContent {...props} />;
}
