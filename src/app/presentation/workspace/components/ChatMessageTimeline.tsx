import { Fragment, useMemo } from 'react';

import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { PollResource } from '../../../../contexts/polls/infrastructure/http/resources/PollResource';
import type { ChatMessageTimelineProps } from './ChatMessageTimelineProps';

import {
  identityDisplayName,
  identityPrimaryDisplayName,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { DateSeparator } from '../../../../contexts/messages/presentation/components/DateSeparator';
import { MessageBubble } from '../../../../contexts/messages/presentation/components/MessageBubble';
import {
  messageReplyImage,
  messageReplySticker,
} from '../../../../contexts/messages/presentation/components/messageTimelineHelpers';
import {
  messageTimelineEnterClassName,
  messageTimelineEnterStyle,
} from '../../../../contexts/messages/presentation/components/messageTimelineMotion';
import { TimelineJumpButton } from '../../../../contexts/messages/presentation/components/TimelineJumpButton';
import {
  MessageTimelineEntries,
  type MessageThreadSummary,
} from '../../../../contexts/messages/presentation/view-models/MessageTimelineEntries';
import { PollCard } from '../../../../contexts/polls/presentation/components/pollCard';
import { cx } from '../../../../shared/presentation/cx';
import { formatDateSeparator } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { LockIcon } from './LockIcon';

function noopPollUpdate(): Promise<void> {
  return Promise.resolve();
}

function noopPollVote(): Promise<void> {
  return Promise.resolve();
}

function messageAuthorName(
  message: ChatMessage,
  currentIdentityName: string,
  identityNames: IdentityNames,
): string {
  if (message.mine) return currentIdentityName;

  return identityDisplayName(message.authorIdentityId, identityNames);
}

function messageAuthorPicture(
  message: ChatMessage,
  currentIdentityId: string,
  identityPictures: IdentityPictures,
): string | undefined {
  return message.mine
    ? identityPictures[currentIdentityId]
    : identityPictures[message.authorIdentityId];
}

function replyAuthorName(
  message: ChatMessage,
  replyMessage: ChatMessage | undefined,
  identityNames: IdentityNames,
): string | undefined {
  if (replyMessage) {
    return identityPrimaryDisplayName(
      identityDisplayName(replyMessage.authorIdentityId, identityNames),
    );
  }

  if (!message.replyPreview) return undefined;

  return identityPrimaryDisplayName(
    identityDisplayName(message.replyPreview.authorIdentityId, identityNames),
  );
}

function threadLastAuthorName(
  threadSummary: MessageThreadSummary | undefined,
  currentIdentityName: string,
  identityNames: IdentityNames,
): string | undefined {
  const lastMessage = threadSummary?.lastMessage;

  if (!lastMessage) return undefined;

  return identityPrimaryDisplayName(
    messageAuthorName(lastMessage, currentIdentityName, identityNames),
  );
}

function threadLastAuthorPicture(
  threadSummary: MessageThreadSummary | undefined,
  currentIdentityId: string,
  identityPictures: IdentityPictures,
): string | undefined {
  const lastMessage = threadSummary?.lastMessage;

  if (!lastMessage) return undefined;

  return messageAuthorPicture(lastMessage, currentIdentityId, identityPictures);
}

function LoadingOlderMessages() {
  return (
    <div className="mx-auto mb-4 w-fit px-4 py-2 text-xs font-black text-white/50">
      {copy.chat.loadingEvents}
    </div>
  );
}

function ReachedMessageStart() {
  return (
    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-white/35">
      <span className="h-px flex-1 bg-white/[0.07]" />
      <span>{copy.chat.noMoreMessages}</span>
      <span className="h-px flex-1 bg-white/[0.07]" />
    </div>
  );
}

function EmptyTimelineState({
  hasConversationKey,
}: {
  hasConversationKey: boolean;
}) {
  if (hasConversationKey) {
    return (
      <div className="py-12 text-center text-sm text-white/55">
        {copy.chat.emptyMessages}
      </div>
    );
  }

  return (
    <div className="grid min-h-[42vh] place-items-center">
      <div className="w-full max-w-md rounded-2xl border border-rose-300/20 bg-rose-500/10 p-5 text-center text-sm text-rose-100">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15">
          <LockIcon locked={false} />
        </div>
        <div className="font-black">{copy.chat.e2eMissing}</div>
        <div className="mt-2 text-rose-100/65">
          {copy.messages.missingConversationKey}
        </div>
      </div>
    </div>
  );
}

function EmptyTimelineFallback({
  hasConversationKey,
  missingConversationKeyContent,
}: {
  hasConversationKey: boolean;
  missingConversationKeyContent?: ChatMessageTimelineProps['missingConversationKeyContent'];
}) {
  if (missingConversationKeyContent && !hasConversationKey) {
    return <>{missingConversationKeyContent}</>;
  }

  return <EmptyTimelineState hasConversationKey={hasConversationKey} />;
}

function MessageTimelineItem({
  currentIdentityId,
  currentIdentityName,
  enterOrder,
  identityNames,
  identityPictures,
  isGroupConversation,
  loadAttachmentPreview,
  message,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onMessageMenuOpen,
  onOpenThread,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  pinnedMessageIds,
  reactionAuthorNames,
  replyMessage,
  startsNewAuthorRun,
  startsNewDay,
  threadSummary,
}: {
  currentIdentityId: string;
  currentIdentityName: string;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  isGroupConversation: boolean;
  enterOrder: number;
  loadAttachmentPreview: ChatMessageTimelineProps['loadAttachmentPreview'];
  message: ChatMessage;
  onAttachmentOpen: ChatMessageTimelineProps['onAttachmentOpen'];
  onAuthorProfileOpen: ChatMessageTimelineProps['onAuthorProfileOpen'];
  onMessageMenuOpen: ChatMessageTimelineProps['onMessageMenuOpen'];
  onOpenThread?: ChatMessageTimelineProps['onOpenThread'];
  onReactionToggle: ChatMessageTimelineProps['onReactionToggle'];
  onReplyReferenceClick: ChatMessageTimelineProps['onReplyReferenceClick'];
  onRetryMessage: ChatMessageTimelineProps['onRetryMessage'];
  onStickerClick?: ChatMessageTimelineProps['onStickerClick'];
  pinnedMessageIds: ReadonlySet<string>;
  reactionAuthorNames: Record<string, string>;
  replyMessage?: ChatMessage;
  startsNewAuthorRun: boolean;
  startsNewDay: boolean;
  threadSummary?: MessageThreadSummary;
}) {
  return (
    <Fragment>
      {startsNewDay && (
        <DateSeparator label={formatDateSeparator(message.timestamp)} />
      )}
      <div className={startsNewDay || startsNewAuthorRun ? 'mt-3' : 'mt-0.5'}>
        <div
          className={messageTimelineEnterClassName(
            message.mine ? 'outgoing' : 'incoming',
          )}
          style={messageTimelineEnterStyle(enterOrder)}
        >
          <MessageBubble
            message={message}
            currentIdentityId={currentIdentityId}
            authorName={messageAuthorName(
              message,
              currentIdentityName,
              identityNames,
            )}
            authorPicture={messageAuthorPicture(
              message,
              currentIdentityId,
              identityPictures,
            )}
            onAttachmentOpen={(attachmentIndex) =>
              onAttachmentOpen(message.attachments[attachmentIndex])
            }
            onAttachmentPreview={loadAttachmentPreview}
            onAvatarClick={(event) =>
              onAuthorProfileOpen(message, event.currentTarget)
            }
            onMessageMenuOpen={onMessageMenuOpen}
            onReactionToggle={onReactionToggle}
            onReplyReferenceClick={onReplyReferenceClick}
            onRetryMessage={onRetryMessage}
            onStickerClick={onStickerClick}
            onThreadOpen={onOpenThread}
            pinned={pinnedMessageIds.has(message.id)}
            reactionAuthorNames={reactionAuthorNames}
            replyImage={messageReplyImage(message, replyMessage)}
            replySticker={messageReplySticker(message, replyMessage)}
            replyAuthorName={replyAuthorName(
              message,
              replyMessage,
              identityNames,
            )}
            replyPreview={
              replyMessage?.content ?? message.replyPreview?.content
            }
            reserveAvatarSpace={false}
            showAvatar={isGroupConversation && startsNewAuthorRun}
            threadAuthorName={threadLastAuthorName(
              threadSummary,
              currentIdentityName,
              identityNames,
            )}
            threadAuthorPicture={threadLastAuthorPicture(
              threadSummary,
              currentIdentityId,
              identityPictures,
            )}
            threadCount={threadSummary?.count}
          />
        </div>
      </div>
    </Fragment>
  );
}

function PollTimelineItem({
  currentIdentityId,
  enterOrder,
  message,
  onClose,
  onMessageMenuOpen,
  onRemoveVote,
  onVote,
  poll,
  startsNewDay,
}: {
  currentIdentityId: string;
  enterOrder: number;
  message: ChatMessage;
  onClose?: (poll: PollResource) => Promise<void>;
  onMessageMenuOpen: ChatMessageTimelineProps['onMessageMenuOpen'];
  onRemoveVote?: (poll: PollResource) => Promise<void>;
  onVote?: (poll: PollResource, optionIds: string[]) => Promise<void>;
  poll: PollResource;
  startsNewDay: boolean;
}) {
  const mine = poll.creatorIdentityId === currentIdentityId;

  return (
    <Fragment>
      {startsNewDay && (
        <DateSeparator label={formatDateSeparator(poll.createdAt)} />
      )}
      <div
        data-message-id={message.id}
        className={cx('mt-4 flex', mine ? 'justify-end' : 'justify-start')}
      >
        <div
          className={cx(
            'w-full max-w-xl',
            messageTimelineEnterClassName(mine ? 'outgoing' : 'incoming'),
          )}
          style={messageTimelineEnterStyle(enterOrder)}
        >
          <PollCard
            currentIdentityId={currentIdentityId}
            onClose={mine ? onClose : undefined}
            onMenuOpen={(x, y) =>
              onMessageMenuOpen(
                {
                  ...message,
                  mine,
                },
                x,
                y,
              )
            }
            onRemoveVote={onRemoveVote ?? noopPollUpdate}
            onVote={onVote ?? noopPollVote}
            poll={poll}
          />
        </div>
      </div>
    </Fragment>
  );
}

function MessageTimelineContent({
  bottomRef,
  currentIdentityId,
  currentIdentityName,
  hasConversationKey,
  identityNames,
  identityPictures,
  isGroupConversation,
  loadAttachmentPreview,
  messages,
  messageState,
  missingConversationKeyContent,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onMessageMenuOpen,
  onOpenThread,
  onPollClose,
  onPollRemoveVote,
  onPollVote,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  pinnedMessageIds,
  polls = [],
  reactionAuthorNames,
}: Omit<
  ChatMessageTimelineProps,
  'newMessageCount' | 'onJumpToLatest' | 'onScroll' | 'scrollerRef'
>) {
  const timelineEntries = useMemo(
    () =>
      MessageTimelineEntries.build(messages, polls, [], isGroupConversation),
    [isGroupConversation, messages, polls],
  );

  return (
    <>
      {messageState === 'loading' && <LoadingOlderMessages />}
      <div>
        {messages.length > 0 && messageState !== 'loading' && (
          <ReachedMessageStart />
        )}
        {timelineEntries.map((entry, index) =>
          entry.type === 'poll' ? (
            <PollTimelineItem
              key={entry.id}
              currentIdentityId={currentIdentityId}
              enterOrder={timelineEntries.length - index - 1}
              message={entry.item.message}
              onClose={onPollClose}
              onMessageMenuOpen={onMessageMenuOpen}
              onRemoveVote={onPollRemoveVote}
              onVote={onPollVote}
              poll={entry.item.poll}
              startsNewDay={entry.startsNewDay}
            />
          ) : (
            <MessageTimelineItem
              key={entry.id}
              currentIdentityId={currentIdentityId}
              currentIdentityName={currentIdentityName}
              identityNames={identityNames}
              identityPictures={identityPictures}
              isGroupConversation={isGroupConversation}
              enterOrder={timelineEntries.length - index - 1}
              loadAttachmentPreview={loadAttachmentPreview}
              message={entry.item.message}
              onAttachmentOpen={onAttachmentOpen}
              onAuthorProfileOpen={onAuthorProfileOpen}
              onMessageMenuOpen={onMessageMenuOpen}
              onOpenThread={onOpenThread}
              onReactionToggle={onReactionToggle}
              onReplyReferenceClick={onReplyReferenceClick}
              onRetryMessage={onRetryMessage}
              onStickerClick={onStickerClick}
              pinnedMessageIds={pinnedMessageIds}
              reactionAuthorNames={reactionAuthorNames}
              replyMessage={entry.replyMessage}
              startsNewAuthorRun={entry.startsNewAuthorRun}
              startsNewDay={entry.startsNewDay}
              threadSummary={entry.threadSummary}
            />
          ),
        )}
        {timelineEntries.length === 0 && messageState !== 'loading' && (
          <EmptyTimelineFallback
            hasConversationKey={hasConversationKey}
            missingConversationKeyContent={missingConversationKeyContent}
          />
        )}
        <div ref={bottomRef} />
      </div>
    </>
  );
}

export function ChatMessageTimeline({
  bottomRef,
  currentIdentityId,
  currentIdentityName,
  hasConversationKey,
  identityNames,
  identityPictures,
  isGroupConversation,
  loadAttachmentPreview,
  messages,
  messageState,
  missingConversationKeyContent,
  newMessageCount,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onJumpToLatest,
  onMessageMenuOpen,
  onOpenThread,
  onPollClose,
  onPollRemoveVote,
  onPollVote,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onScroll,
  onStickerClick,
  pinnedMessageIds,
  polls = [],
  reactionAuthorNames,
  scrollerRef,
}: ChatMessageTimelineProps) {
  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto px-2 py-3 [overflow-anchor:none] sm:p-6"
    >
      <MessageTimelineContent
        bottomRef={bottomRef}
        currentIdentityId={currentIdentityId}
        currentIdentityName={currentIdentityName}
        hasConversationKey={hasConversationKey}
        identityNames={identityNames}
        identityPictures={identityPictures}
        isGroupConversation={isGroupConversation}
        loadAttachmentPreview={loadAttachmentPreview}
        missingConversationKeyContent={missingConversationKeyContent}
        messageState={messageState}
        messages={messages}
        onAttachmentOpen={onAttachmentOpen}
        onAuthorProfileOpen={onAuthorProfileOpen}
        onMessageMenuOpen={onMessageMenuOpen}
        onOpenThread={onOpenThread}
        onReactionToggle={onReactionToggle}
        onReplyReferenceClick={onReplyReferenceClick}
        onRetryMessage={onRetryMessage}
        onPollClose={onPollClose}
        onPollRemoveVote={onPollRemoveVote}
        onPollVote={onPollVote}
        onStickerClick={onStickerClick}
        pinnedMessageIds={pinnedMessageIds}
        polls={polls}
        reactionAuthorNames={reactionAuthorNames}
      />
      {newMessageCount > 0 && (
        <TimelineJumpButton mode="sticky" onClick={onJumpToLatest}>
          {copy.workspace.newMessages}
          {newMessageCount > 1 ? ` (${newMessageCount})` : ''}
        </TimelineJumpButton>
      )}
    </div>
  );
}
