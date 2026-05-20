/* eslint-disable @typescript-eslint/no-use-before-define */
import type { RefObject } from 'react';

import { Fragment, useMemo } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  MessageAttachment,
  PollResource,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../identities/presentation/view-models/identityDisplay';

import { copy } from '../../../../shared/presentation/i18n/en';
import { formatDateSeparator } from '../../../../shared/presentation/formatting';
import {
  identityDisplayName,
  identityPrimaryDisplayName,
} from '../../../identities/presentation/view-models/identityDisplay';
import { DateSeparator } from '../../../messages/presentation/components/dateSeparator';
import { MessageBubble } from '../../../messages/presentation/components/messageBubble';
import { MessageListSkeleton } from '../../../messages/presentation/components/messageListSkeleton';
import { messagePollTimelineItems } from '../../../messages/presentation/components/messagePollTimelineItems';
import {
  messageReplyImage,
  messageReplySticker,
  startsAuthorRun,
} from '../../../messages/presentation/components/messageTimelineHelpers';
import { PollCard } from '../../../messages/presentation/components/pollCard';
import { LockIcon } from './lockIcon';

type LoadState = 'idle' | 'loading' | 'error';

interface ChatMessageTimelineProps {
  bottomRef: RefObject<HTMLDivElement | null>;
  currentIdentityId: string;
  currentIdentityName: string;
  hasConversationKey: boolean;
  hasReachedMessageStart: boolean;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  isGroupConversation: boolean;
  loadAttachmentPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
  messageState: LoadState;
  messages: ChatMessage[];
  newMessageCount: number;
  onAttachmentOpen: (attachment?: MessageAttachment) => void;
  onAuthorProfileOpen: (
    message: ChatMessage,
    target: HTMLElement | null,
  ) => void;
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onReactionToggle: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onPollClose?: (poll: PollResource) => Promise<void>;
  onPollRemoveVote?: (poll: PollResource) => Promise<void>;
  onPollVote?: (poll: PollResource, optionIds: string[]) => Promise<void>;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  onScroll: () => void;
  reactionAuthorNames: Record<string, string>;
  polls?: PollResource[];
  scrollerRef: RefObject<HTMLDivElement | null>;
}

export function ChatMessageTimeline({
  bottomRef,
  currentIdentityId,
  currentIdentityName,
  hasConversationKey,
  hasReachedMessageStart,
  identityNames,
  identityPictures,
  isGroupConversation,
  loadAttachmentPreview,
  messages,
  messageState,
  newMessageCount,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onJumpToLatest,
  onMessageMenuOpen,
  onPollClose,
  onPollRemoveVote,
  onPollVote,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onScroll,
  onStickerClick,
  polls = [],
  reactionAuthorNames,
  scrollerRef,
}: ChatMessageTimelineProps) {
  const loadingInitialMessages =
    messageState === 'loading' && messages.length === 0;

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-2 py-3 sm:p-6"
    >
      {loadingInitialMessages ? (
        <div className="grid min-h-full place-items-center">
          <MessageListSkeleton />
        </div>
      ) : (
        <MessageTimelineContent
          bottomRef={bottomRef}
          currentIdentityId={currentIdentityId}
          currentIdentityName={currentIdentityName}
          hasConversationKey={hasConversationKey}
          hasReachedMessageStart={hasReachedMessageStart}
          identityNames={identityNames}
          identityPictures={identityPictures}
          isGroupConversation={isGroupConversation}
          loadAttachmentPreview={loadAttachmentPreview}
          messageState={messageState}
          messages={messages}
          onAttachmentOpen={onAttachmentOpen}
          onAuthorProfileOpen={onAuthorProfileOpen}
          onMessageMenuOpen={onMessageMenuOpen}
          onReactionToggle={onReactionToggle}
          onReplyReferenceClick={onReplyReferenceClick}
          onRetryMessage={onRetryMessage}
          onPollClose={onPollClose}
          onPollRemoveVote={onPollRemoveVote}
          onPollVote={onPollVote}
          onStickerClick={onStickerClick}
          polls={polls}
          reactionAuthorNames={reactionAuthorNames}
        />
      )}
      {newMessageCount > 0 && (
        <button
          type="button"
          onClick={onJumpToLatest}
          className="sticky bottom-3 left-1/2 z-20 mt-3 -translate-x-1/2 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:bg-fuchsia-400"
        >
          {copy.workspace.newMessages}
          {newMessageCount > 1 ? ` (${newMessageCount})` : ''}
        </button>
      )}
    </div>
  );
}

function MessageTimelineContent({
  bottomRef,
  currentIdentityId,
  currentIdentityName,
  hasConversationKey,
  hasReachedMessageStart,
  identityNames,
  identityPictures,
  isGroupConversation,
  loadAttachmentPreview,
  messages,
  messageState,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onMessageMenuOpen,
  onPollClose,
  onPollRemoveVote,
  onPollVote,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  polls = [],
  reactionAuthorNames,
}: Omit<
  ChatMessageTimelineProps,
  'newMessageCount' | 'onJumpToLatest' | 'onScroll' | 'scrollerRef'
>) {
  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const timelineItems = useMemo(
    () => messagePollTimelineItems(messages, polls),
    [messages, polls],
  );

  return (
    <>
      {messageState === 'loading' && <LoadingOlderMessages />}
      <div>
        {hasReachedMessageStart &&
          messages.length > 0 &&
          messageState !== 'loading' && <ReachedMessageStart />}
        {timelineItems.map((item, index) =>
          item.type === 'poll' ? (
            <PollTimelineItem
              key={item.id}
              currentIdentityId={currentIdentityId}
              onClose={onPollClose}
              onRemoveVote={onPollRemoveVote}
              onVote={onPollVote}
              poll={item.poll}
              previousTimestamp={timelineItems[index - 1]?.timestamp}
            />
          ) : (
            <MessageTimelineItem
              key={item.id}
              currentIdentityId={currentIdentityId}
              currentIdentityName={currentIdentityName}
              identityNames={identityNames}
              identityPictures={identityPictures}
              isGroupConversation={isGroupConversation}
              loadAttachmentPreview={loadAttachmentPreview}
              message={item.message}
              onAttachmentOpen={onAttachmentOpen}
              onAuthorProfileOpen={onAuthorProfileOpen}
              onMessageMenuOpen={onMessageMenuOpen}
              onReactionToggle={onReactionToggle}
              onReplyReferenceClick={onReplyReferenceClick}
              onRetryMessage={onRetryMessage}
              onStickerClick={onStickerClick}
              previousMessage={
                timelineItems
                  .slice(0, index)
                  .reverse()
                  .find((candidate) => candidate.type === 'message')?.message
              }
              previousTimestamp={timelineItems[index - 1]?.timestamp}
              reactionAuthorNames={reactionAuthorNames}
              replyMessage={
                item.message.replyToMessageId
                  ? messagesById.get(item.message.replyToMessageId)
                  : undefined
              }
            />
          ),
        )}
        {timelineItems.length === 0 && messageState !== 'loading' && (
          <EmptyTimelineState hasConversationKey={hasConversationKey} />
        )}
        <div ref={bottomRef} />
      </div>
    </>
  );
}

function MessageTimelineItem({
  currentIdentityId,
  currentIdentityName,
  identityNames,
  identityPictures,
  isGroupConversation,
  loadAttachmentPreview,
  message,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onMessageMenuOpen,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  previousMessage,
  previousTimestamp,
  reactionAuthorNames,
  replyMessage,
}: {
  currentIdentityId: string;
  currentIdentityName: string;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  isGroupConversation: boolean;
  loadAttachmentPreview: ChatMessageTimelineProps['loadAttachmentPreview'];
  message: ChatMessage;
  onAttachmentOpen: ChatMessageTimelineProps['onAttachmentOpen'];
  onAuthorProfileOpen: ChatMessageTimelineProps['onAuthorProfileOpen'];
  onMessageMenuOpen: ChatMessageTimelineProps['onMessageMenuOpen'];
  onReactionToggle: ChatMessageTimelineProps['onReactionToggle'];
  onReplyReferenceClick: ChatMessageTimelineProps['onReplyReferenceClick'];
  onRetryMessage: ChatMessageTimelineProps['onRetryMessage'];
  onStickerClick?: ChatMessageTimelineProps['onStickerClick'];
  previousMessage?: ChatMessage;
  previousTimestamp?: number;
  reactionAuthorNames: Record<string, string>;
  replyMessage?: ChatMessage;
}) {
  const startsNewDay = startsTimelineDay(previousTimestamp, message.timestamp);
  const startsNewAuthorRun = startsAuthorRun(previousMessage, message);

  return (
    <Fragment>
      {startsNewDay && (
        <DateSeparator label={formatDateSeparator(message.timestamp)} />
      )}
      <div className={startsNewDay || startsNewAuthorRun ? 'mt-4' : 'mt-1'}>
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
          reactionAuthorNames={reactionAuthorNames}
          replyImage={messageReplyImage(message, replyMessage)}
          replySticker={messageReplySticker(message, replyMessage)}
          replyAuthorName={replyAuthorName(
            message,
            replyMessage,
            identityNames,
          )}
          replyPreview={replyMessage?.content ?? message.replyPreview?.content}
          reserveAvatarSpace={false}
          showAvatar={isGroupConversation && startsNewAuthorRun}
        />
      </div>
    </Fragment>
  );
}

function PollTimelineItem({
  currentIdentityId,
  onClose,
  onRemoveVote,
  onVote,
  poll,
  previousTimestamp,
}: {
  currentIdentityId: string;
  onClose?: (poll: PollResource) => Promise<void>;
  onRemoveVote?: (poll: PollResource) => Promise<void>;
  onVote?: (poll: PollResource, optionIds: string[]) => Promise<void>;
  poll: PollResource;
  previousTimestamp?: number;
}) {
  return (
    <Fragment>
      {startsTimelineDay(previousTimestamp, poll.createdAt) && (
        <DateSeparator label={formatDateSeparator(poll.createdAt)} />
      )}
      <div className="mt-4">
        <PollCard
          currentIdentityId={currentIdentityId}
          onClose={onClose}
          onRemoveVote={onRemoveVote ?? noopPollUpdate}
          onVote={onVote ?? noopPollVote}
          poll={poll}
        />
      </div>
    </Fragment>
  );
}

function startsTimelineDay(
  previousTimestamp: number | undefined,
  timestamp: number,
): boolean {
  if (!previousTimestamp) return true;

  return (
    new Date(previousTimestamp).toDateString() !==
    new Date(timestamp).toDateString()
  );
}

function noopPollUpdate(): Promise<void> {
  return Promise.resolve();
}

function noopPollVote(): Promise<void> {
  return Promise.resolve();
}

function LoadingOlderMessages() {
  return (
    <div className="mx-auto mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/60">
      {copy.chat.loadingEvents}
    </div>
  );
}

function ReachedMessageStart() {
  return (
    <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
      {copy.chat.noMoreMessages}
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
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
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
