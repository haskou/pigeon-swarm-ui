/* eslint-disable complexity */
import { Fragment, memo, type RefObject, useMemo } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  IdentityResource,
  MessageAttachment,
  PollResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { MarkdownMention } from '../../../messages/presentation/components/markdownMessage';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { formatDateSeparator } from '../../../../shared/presentation/formatting';
import { cx } from '../../../../shared/presentation/cx';
import { DateSeparator } from '../../../messages/presentation/components/DateSeparator';
import { MessageBubble } from '../../../messages/presentation/components/MessageBubble';
import { MessageListSkeleton } from '../../../messages/presentation/components/MessageListSkeleton';
import { messagePollTimelineItems } from '../../../polls/presentation/components/messagePollTimelineItems';
import {
  endsAuthorRun,
  messageReplyImage,
  messageReplySticker,
  startsAuthorRun,
} from '../../../messages/presentation/components/messageTimelineHelpers';
import { PollCard } from '../../../polls/presentation/components/pollCard';
import { LockIcon } from '../../../../app/presentation/workspace/components/LockIcon';
import { memberDisplayName, memberPrimaryName } from './communityMemberNames';

type LoadState = 'error' | 'idle' | 'loading';

interface CommunityMessageTimelineProps {
  bottomRef: RefObject<HTMLDivElement | null>;
  isAwayFromBottom: boolean;
  loadAttachmentPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
  memberIdentities: Record<string, IdentityResource>;
  memberPictures: Record<string, string>;
  messageCursor: null | string;
  messageState: LoadState;
  missingCommunityKey: boolean;
  newChannelMessageCount: number;
  onAddCommunityKey: () => void;
  onAttachmentOpen: (attachment?: MessageAttachment) => void;
  onAuthorProfileOpen: (message: ChatMessage, target: HTMLElement) => void;
  onIdentityProfileOpen?: (identityId: string, target: HTMLElement) => void;
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
  canClosePolls: boolean;
  onPollRemoveVote?: (poll: PollResource) => Promise<void>;
  onPollVote?: (poll: PollResource, optionIds: string[]) => Promise<void>;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  onScroll: () => void;
  reactionAuthorNames: Record<string, string>;
  polls?: PollResource[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  session: Session;
  visibleMessages: ChatMessage[];
}

export const CommunityMessageTimeline = memo(function CommunityMessageTimeline({
  bottomRef,
  isAwayFromBottom,
  loadAttachmentPreview,
  memberIdentities,
  memberPictures,
  messageCursor,
  messageState,
  missingCommunityKey,
  newChannelMessageCount,
  onAddCommunityKey,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onIdentityProfileOpen,
  onJumpToLatest,
  onMessageMenuOpen,
  onPollClose,
  canClosePolls,
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
  session,
  visibleMessages,
}: CommunityMessageTimelineProps) {
  const messagesById = useMemo(
    () => new Map(visibleMessages.map((message) => [message.id, message])),
    [visibleMessages],
  );
  const timelineItems = useMemo(
    () => messagePollTimelineItems(visibleMessages, polls),
    [polls, visibleMessages],
  );

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto p-4 sm:p-6"
      >
        {messageState === 'loading' && visibleMessages.length === 0 ? (
          <MessageListSkeleton />
        ) : messageState === 'loading' ? (
          <div className="mx-auto mb-4 w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/60">
            {copy.chat.loadingEvents}
          </div>
        ) : null}
        <div>
          {!messageCursor &&
            visibleMessages.length > 0 &&
            messageState !== 'loading' && (
              <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                {copy.chat.noMoreMessages}
              </div>
            )}
          {missingCommunityKey && (
            <div className="grid min-h-[28vh] place-items-center">
              <div className="w-full max-w-md rounded-2xl border border-rose-300/20 bg-rose-500/10 p-5 text-center text-sm text-rose-100">
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-rose-500/15">
                  <LockIcon locked={false} />
                </div>
                <div className="font-black">{copy.chat.e2eMissing}</div>
                <div className="mt-2 text-rose-100/65">
                  {copy.messages.missingCommunityKey}
                </div>
                <button
                  type="button"
                  onClick={onAddCommunityKey}
                  className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
                >
                  {copy.chat.addPrivateKey}
                </button>
              </div>
            </div>
          )}
          {!missingCommunityKey &&
            timelineItems.map((item, index) => {
              if (item.type === 'poll') {
                return (
                  <Fragment key={item.id}>
                    {startsTimelineDay(
                      timelineItems[index - 1]?.timestamp,
                      item.poll.createdAt,
                    ) && (
                      <DateSeparator
                        label={formatDateSeparator(item.poll.createdAt)}
                      />
                    )}
                    <div
                      className={cx(
                        'mt-4 flex',
                        item.poll.creatorIdentityId === session.identity.id
                          ? 'justify-end'
                          : 'justify-start',
                      )}
                    >
                      <div className="w-full max-w-xl">
                        <PollCard
                          currentIdentityId={session.identity.id}
                          onClose={
                            canCloseCommunityPoll(
                              item.poll,
                              session.identity.id,
                              canClosePolls,
                            )
                              ? onPollClose
                              : undefined
                          }
                          onRemoveVote={onPollRemoveVote ?? noopPollUpdate}
                          onVote={onPollVote ?? noopPollVote}
                          poll={item.poll}
                        />
                      </div>
                    </div>
                  </Fragment>
                );
              }

              const message = item.message;
              const previousMessage = timelineItems
                .slice(0, index)
                .reverse()
                .find((candidate) => candidate.type === 'message')?.message;
              const nextMessage = timelineItems
                .slice(index + 1)
                .find((candidate) => candidate.type === 'message')?.message;
              const replyMessage = message.replyToMessageId
                ? messagesById.get(message.replyToMessageId)
                : undefined;
              const startsNewDay = startsTimelineDay(
                timelineItems[index - 1]?.timestamp,
                message.timestamp,
              );
              const startsNewAuthorRun = startsAuthorRun(
                previousMessage,
                message,
              );
              const showAvatar = endsAuthorRun(nextMessage, message);

              return (
                <Fragment key={item.id}>
                  {startsNewDay && (
                    <DateSeparator
                      label={formatDateSeparator(message.timestamp)}
                    />
                  )}
                  <div
                    className={
                      startsNewDay || startsNewAuthorRun ? 'mt-4' : 'mt-1'
                    }
                  >
                    <MessageBubble
                      message={message}
                      currentIdentityId={session.identity.id}
                      authorName={
                        message.mine
                          ? session.identity.profile.name
                          : memberDisplayName(
                              memberIdentities[message.authorIdentityId],
                              message.authorIdentityId,
                            )
                      }
                      authorPicture={
                        message.mine
                          ? memberPictures[session.identity.id]
                          : memberPictures[message.authorIdentityId]
                      }
                      onAttachmentOpen={(attachmentIndex) =>
                        onAttachmentOpen(message.attachments[attachmentIndex])
                      }
                      onAttachmentPreview={loadAttachmentPreview}
                      onAvatarClick={(event) =>
                        onAuthorProfileOpen(message, event.currentTarget)
                      }
                      onMessageMenuOpen={onMessageMenuOpen}
                      onMentionClick={onIdentityProfileOpen}
                      onReactionToggle={onReactionToggle}
                      onReplyReferenceClick={onReplyReferenceClick}
                      onRetryMessage={onRetryMessage}
                      onStickerClick={onStickerClick}
                      reactionAuthorNames={reactionAuthorNames}
                      mentionTokens={messageMentionTokens(
                        message,
                        memberIdentities,
                      )}
                      replyImage={messageReplyImage(message, replyMessage)}
                      replySticker={messageReplySticker(message, replyMessage)}
                      replyAuthorName={
                        replyMessage
                          ? memberPrimaryName(
                              memberIdentities[replyMessage.authorIdentityId],
                              replyMessage.authorIdentityId,
                            )
                          : message.replyPreview
                            ? memberPrimaryName(
                                memberIdentities[
                                  message.replyPreview.authorIdentityId
                                ],
                                message.replyPreview.authorIdentityId,
                              )
                            : undefined
                      }
                      replyPreview={
                        replyMessage?.content ?? message.replyPreview?.content
                      }
                      showAvatar={showAvatar}
                    />
                  </div>
                </Fragment>
              );
            })}
          {timelineItems.length === 0 && messageState !== 'loading' && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
              {copy.communities.emptyChannel}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      {(newChannelMessageCount > 0 || isAwayFromBottom) && (
        <button
          type="button"
          onClick={onJumpToLatest}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:bg-fuchsia-400"
        >
          {newChannelMessageCount > 0
            ? newChannelMessageCount > 1
              ? copy.chat.newMessages
              : copy.chat.newMessage
            : copy.chat.jumpToLatest}
        </button>
      )}
    </div>
  );
});

function canCloseCommunityPoll(
  poll: PollResource,
  currentIdentityId: string,
  canClosePolls: boolean,
): boolean {
  return canClosePolls || poll.creatorIdentityId === currentIdentityId;
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

function messageMentionTokens(
  message: ChatMessage,
  memberIdentities: Record<string, IdentityResource>,
): MarkdownMention[] {
  return (message.mentions ?? []).flatMap((mention): MarkdownMention[] => {
    if (mention.type !== 'identity') return [];

    const identity = memberIdentities[mention.targetId];
    const tokens = new Set<string>();
    const handle = identity?.profile.handle?.trim();
    const name = memberPrimaryName(identity, mention.targetId);

    if (handle) tokens.add(`@${handle}`);
    tokens.add(`@${name}`);

    return [...tokens].map((token) => ({
      identityId: mention.targetId,
      token,
    }));
  });
}
