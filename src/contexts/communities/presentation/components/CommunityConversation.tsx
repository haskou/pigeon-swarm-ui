import { lazy, Suspense } from 'react';

import type {
  ChatMessage,
  CommunityInvitationNotificationResource,
  CommunityPermission,
  CommunityTextChannel,
  IdentityResource,
  PollResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { useCommunityChannelMessages } from './useCommunityChannelMessages';
import type { useCommunityMentions } from './useCommunityMentions';
import type { useCommunityMessageComposer } from './useCommunityMessageComposer';
import type { useCommunityPollWorkflow } from './useCommunityPollWorkflow';
import type { useCommunityProfileViewer } from './useCommunityProfileViewer';

import { profileAnchorFromTarget } from '../../../identities/presentation/view-models/profilePopoverAnchor';
import { Composer } from '../../../messages/presentation/components/Composer';
import { TypingIndicator } from '../../../messages/presentation/components/TypingIndicator';
import { memberDisplayName, memberPrimaryName } from './communityMemberNames';
import { CommunityMentionPanel } from './communityMentionPanel';
import { CommunityMessageTimeline } from './CommunityMessageTimeline';

const CreatePollDialog = lazy(() =>
  import('../../../polls/presentation/components/CreatePollDialog').then(
    (module) => ({
      default: module.CreatePollDialog,
    }),
  ),
);
const StickerPackPreviewDialog = lazy(() =>
  import('../../../stickers/presentation/components/StickerPackPreviewDialog').then(
    (module) => ({
      default: module.StickerPackPreviewDialog,
    }),
  ),
);

type CommunityConversationProps = {
  channelMessages: ReturnType<typeof useCommunityChannelMessages>;
  communityIsPublic: boolean;
  currentPermissions: Set<CommunityPermission>;
  currentRoleIds: ReadonlySet<string>;
  draft: string;
  hasCommunityKey: boolean;
  invitationAccepting: boolean;
  invitationError?: null | string;
  invitationInviterName?: string;
  memberIdentities: Record<string, IdentityResource>;
  memberPictures: Record<string, string>;
  mentions: ReturnType<typeof useCommunityMentions>;
  messageComposer: ReturnType<typeof useCommunityMessageComposer>;
  missingCommunityKey: boolean;
  onAddCommunityKey: () => void;
  onInvitationAccept?: (
    notification: CommunityInvitationNotificationResource,
  ) => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onOpenThread: (message: ChatMessage) => void;
  onPollDialogClose: () => void;
  onPollDialogOpen: () => void;
  onStickerClick: (sticker: StickerMessageReference) => void;
  onStickerPreviewClose: () => void;
  pendingInvitation?: CommunityInvitationNotificationResource | null;
  pinnedMessageIds: ReadonlySet<string>;
  pollDialogOpen: boolean;
  pollWorkflow: ReturnType<typeof useCommunityPollWorkflow>;
  polls: PollResource[];
  profiles: ReturnType<typeof useCommunityProfileViewer>;
  reactionAuthorNames: Record<string, string>;
  selectedChannel: CommunityTextChannel;
  session: Session;
  stickerPackPreview: StickerMessageReference | null;
  typingIdentityIds: string[];
};

export function CommunityConversation({
  channelMessages,
  communityIsPublic,
  currentPermissions,
  currentRoleIds,
  draft,
  hasCommunityKey,
  invitationAccepting,
  invitationError,
  invitationInviterName,
  memberIdentities,
  memberPictures,
  mentions,
  messageComposer,
  missingCommunityKey,
  onAddCommunityKey,
  onInvitationAccept,
  onMessageMenuOpen,
  onOpenThread,
  onPollDialogClose,
  onPollDialogOpen,
  onStickerClick,
  onStickerPreviewClose,
  pendingInvitation,
  pinnedMessageIds,
  pollDialogOpen,
  pollWorkflow,
  polls,
  profiles,
  reactionAuthorNames,
  selectedChannel,
  session,
  stickerPackPreview,
  typingIdentityIds,
}: CommunityConversationProps) {
  const {
    bottomRef,
    handleMessagesScroll,
    isAwayFromBottom,
    jumpToLatest,
    messageCursor,
    messageState,
    newChannelMessageCount,
    scrollerRef,
    selectedChannelId,
    visibleMessages,
  } = channelMessages;

  return (
    <>
      <CommunityMessageTimeline
        bottomRef={bottomRef}
        isAwayFromBottom={isAwayFromBottom}
        loadAttachmentPreview={messageComposer.loadAttachmentPreview}
        memberIdentities={memberIdentities}
        memberPictures={memberPictures}
        messageCursor={messageCursor}
        messageState={messageState}
        missingCommunityKey={missingCommunityKey}
        invitationAccepting={invitationAccepting}
        invitationError={invitationError}
        invitationInviterName={invitationInviterName}
        newChannelMessageCount={newChannelMessageCount}
        onAddCommunityKey={onAddCommunityKey}
        onInvitationAccept={onInvitationAccept}
        onAttachmentOpen={(attachment) =>
          void messageComposer.openAttachment(attachment)
        }
        onAuthorProfileOpen={(message, target) =>
          profiles.openMessageAuthorProfile(
            message,
            profileAnchorFromTarget(target),
          )
        }
        onIdentityProfileOpen={profiles.openIdentityProfile}
        onJumpToLatest={jumpToLatest}
        onMessageMenuOpen={onMessageMenuOpen}
        onOpenThread={onOpenThread}
        onReactionToggle={(message, emoji, reacted) =>
          void messageComposer.handleToggleChannelMessageReaction(
            message,
            emoji,
            reacted,
          )
        }
        onReplyReferenceClick={messageComposer.handleReplyReferenceClick}
        onRetryMessage={messageComposer.retryChannelMessage}
        canClosePolls={currentPermissions.has('create_polls')}
        channelThreadSummaries={selectedChannel.threads ?? []}
        onPollClose={pollWorkflow.closePoll}
        onPollRemoveVote={pollWorkflow.removePollVote}
        onPollVote={pollWorkflow.votePoll}
        onScroll={handleMessagesScroll}
        onStickerClick={onStickerClick}
        currentRoleIds={currentRoleIds}
        reactionAuthorNames={reactionAuthorNames}
        pendingInvitation={pendingInvitation}
        polls={polls}
        pinnedMessageIds={pinnedMessageIds}
        scrollerRef={scrollerRef}
        session={session}
        visibleMessages={visibleMessages}
      />
      {typingIdentityIds.length > 0 && (
        <TypingIndicator
          getIdentityName={(identityId) =>
            memberPrimaryName(memberIdentities[identityId], identityId)
          }
          identityIds={typingIdentityIds}
        />
      )}
      <Composer
        attachmentEncryptionAvailable={!communityIsPublic && hasCommunityKey}
        disabled={
          messageState === 'loading' ||
          (!communityIsPublic && !hasCommunityKey) ||
          !currentPermissions.has('send_messages')
        }
        defaultEncryptAttachments={!communityIsPublic}
        draft={draft}
        editingMessage={messageComposer.editingMessage}
        error={messageComposer.error}
        focusKey={`${selectedChannelId ?? 'no-channel'}:${
          messageComposer.editingMessage?.id ?? 'send'
        }`}
        onCancelEdit={messageComposer.cancelEditingChannelMessage}
        onCancelReply={messageComposer.clearReplyTarget}
        onDraftChange={messageComposer.handleDraftChange}
        onEdit={messageComposer.handleEditChannelMessage}
        onEscape={
          messageComposer.editingMessage
            ? messageComposer.cancelEditingChannelMessage
            : () => undefined
        }
        onSend={messageComposer.handleSendChannelMessage}
        onStickerSend={
          currentPermissions.has('send_stickers')
            ? messageComposer.handleSendChannelSticker
            : undefined
        }
        mentionHelper={
          mentions.suggestions.length > 0 ? (
            <CommunityMentionPanel
              onSelect={mentions.insert}
              suggestions={mentions.suggestions}
            />
          ) : null
        }
        mentionTokens={mentions.tokens}
        onMentionAutocomplete={mentions.autocomplete}
        onPollCreate={
          currentPermissions.has('create_polls') ? onPollDialogOpen : undefined
        }
        progress={messageComposer.attachmentProgress}
        replyTo={messageComposer.replyTarget}
        replyToAuthorName={
          messageComposer.replyTarget
            ? memberDisplayName(
                memberIdentities[messageComposer.replyTarget.authorIdentityId],
                messageComposer.replyTarget.authorIdentityId,
              )
            : undefined
        }
        session={session}
      />
      {stickerPackPreview && (
        <Suspense fallback={null}>
          <StickerPackPreviewDialog
            onClose={onStickerPreviewClose}
            onStickerSend={messageComposer.handleSendChannelSticker}
            session={session}
            sticker={stickerPackPreview}
          />
        </Suspense>
      )}
      {pollDialogOpen && (
        <Suspense fallback={null}>
          <CreatePollDialog
            onClose={onPollDialogClose}
            onSubmit={pollWorkflow.handleCreatePoll}
          />
        </Suspense>
      )}
    </>
  );
}
