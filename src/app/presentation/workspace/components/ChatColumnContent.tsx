import type { ReactNode } from 'react';

import { lazy, Suspense, useState } from 'react';

import type { IdentityNames } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type {
  ChatMessage,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { ChatColumnProps } from './ChatColumnProps';
import type { ConversationPollsController } from './useConversationPolls';

import { useAttachmentDownload } from '../../../../contexts/attachments/presentation/hooks/useAttachmentDownload';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { ChatConversationComposer } from './ChatConversationComposer';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatMessageTimeline } from './ChatMessageTimeline';
import { ChatTypingIndicator } from './ChatTypingIndicator';

const CreatePollDialog = lazy(() =>
  import('../../../../contexts/polls/presentation/components/CreatePollDialog').then(
    (module) => ({ default: module.CreatePollDialog }),
  ),
);
const StickerPackPreviewDialog = lazy(() =>
  import('../../../../contexts/stickers/presentation/components/StickerPackPreviewDialog').then(
    (module) => ({ default: module.StickerPackPreviewDialog }),
  ),
);

export function ChatColumnContent({
  activeConversation,
  bottomRef,
  canCreatePoll,
  draft,
  editingMessage,
  hasConversationKey,
  hasPendingInvitation,
  hasReachedMessageStart,
  identityNames,
  identityPictures,
  invitationPrompt,
  isGroupConversation,
  messages,
  messageState,
  newMessageCount,
  onCancelEdit,
  onCancelReply,
  onCreate,
  onDraftChange,
  onEditMessage,
  onEscape,
  onJumpToLatest,
  onMessageAuthorProfileOpen,
  onMessageMenuOpen,
  onOpenMessageThread,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onScroll,
  onSend,
  onStickerSend,
  onTypingActive,
  pinnedMessageIds,
  polls,
  progress,
  reactionAuthorNames,
  replyToMessage,
  scrollerRef,
  sendError,
  session,
  typingIdentityIds,
}: Pick<
  ChatColumnProps,
  | 'activeConversation'
  | 'bottomRef'
  | 'draft'
  | 'editingMessage'
  | 'hasConversationKey'
  | 'hasReachedMessageStart'
  | 'identityNames'
  | 'identityPictures'
  | 'messageState'
  | 'messages'
  | 'newMessageCount'
  | 'onCancelEdit'
  | 'onCancelReply'
  | 'onCreate'
  | 'onDraftChange'
  | 'onEditMessage'
  | 'onEscape'
  | 'onJumpToLatest'
  | 'onMessageMenuOpen'
  | 'onOpenMessageThread'
  | 'onReactionToggle'
  | 'onReplyReferenceClick'
  | 'onRetryMessage'
  | 'onScroll'
  | 'onSend'
  | 'onStickerSend'
  | 'onTypingActive'
  | 'pinnedMessageIds'
  | 'progress'
  | 'replyToMessage'
  | 'scrollerRef'
  | 'sendError'
  | 'session'
  | 'typingIdentityIds'
> & {
  canCreatePoll: boolean;
  hasPendingInvitation: boolean;
  invitationPrompt: ReactNode;
  isGroupConversation: boolean;
  onMessageAuthorProfileOpen: (
    message: ChatMessage,
    target: HTMLElement | null,
  ) => void;
  polls: ConversationPollsController;
  reactionAuthorNames: IdentityNames;
}) {
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] =
    useState<ChatColumnProps['progress']>(null);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [stickerPackPreview, setStickerPackPreview] =
    useState<StickerMessageReference | null>(null);
  const { loadAttachmentPreview, openAttachment } = useAttachmentDownload({
    errorMessage: copy.composer.attachmentDownloadError,
    onErrorChange: setAttachmentError,
    onProgressChange: setDownloadProgress,
  });

  if (!activeConversation) return <ChatEmptyState onCreate={onCreate} />;

  return (
    <>
      <ChatMessageTimeline
        bottomRef={bottomRef}
        currentIdentityId={session.identity.id}
        currentIdentityName={session.identity.profile.name}
        hasConversationKey={hasConversationKey}
        hasReachedMessageStart={hasReachedMessageStart}
        identityNames={identityNames}
        identityPictures={identityPictures}
        isGroupConversation={isGroupConversation}
        loadAttachmentPreview={loadAttachmentPreview}
        messageState={messageState}
        missingConversationKeyContent={invitationPrompt}
        messages={messages}
        newMessageCount={newMessageCount}
        onAttachmentOpen={(attachment) => void openAttachment(attachment)}
        onAuthorProfileOpen={onMessageAuthorProfileOpen}
        onJumpToLatest={onJumpToLatest}
        onMessageMenuOpen={onMessageMenuOpen}
        onOpenThread={isGroupConversation ? onOpenMessageThread : undefined}
        onReactionToggle={onReactionToggle}
        onReplyReferenceClick={onReplyReferenceClick}
        onRetryMessage={onRetryMessage}
        onPollClose={polls.close}
        onPollRemoveVote={polls.removeVote}
        onPollVote={polls.vote}
        onStickerClick={setStickerPackPreview}
        onScroll={onScroll}
        pinnedMessageIds={pinnedMessageIds}
        polls={polls.active}
        reactionAuthorNames={reactionAuthorNames}
        scrollerRef={scrollerRef}
      />
      {!!typingIdentityIds?.length && (
        <ChatTypingIndicator
          identityIds={typingIdentityIds}
          identityNames={identityNames}
        />
      )}
      <ChatConversationComposer
        activeConversationId={activeConversation.id}
        attachmentError={attachmentError}
        canCreatePoll={canCreatePoll}
        downloadProgress={downloadProgress}
        draft={draft}
        editingMessage={editingMessage}
        hasConversationKey={hasConversationKey}
        hasPendingInvitation={hasPendingInvitation}
        identityNames={identityNames}
        messageState={messageState}
        onCancelEdit={onCancelEdit}
        onCancelReply={onCancelReply}
        onDraftChange={onDraftChange}
        onEditMessage={onEditMessage}
        onEscape={onEscape}
        onPollCreate={() => setPollDialogOpen(true)}
        onSend={onSend}
        onStickerSend={onStickerSend}
        onTypingActive={onTypingActive}
        progress={progress}
        replyToMessage={replyToMessage}
        sendError={sendError}
        session={session}
      />
      {stickerPackPreview && (
        <Suspense fallback={null}>
          <StickerPackPreviewDialog
            onClose={() => setStickerPackPreview(null)}
            onStickerSend={onStickerSend}
            session={session}
            sticker={stickerPackPreview}
          />
        </Suspense>
      )}
      {pollDialogOpen && (
        <Suspense fallback={null}>
          <CreatePollDialog
            onClose={() => setPollDialogOpen(false)}
            onSubmit={polls.create}
          />
        </Suspense>
      )}
    </>
  );
}
