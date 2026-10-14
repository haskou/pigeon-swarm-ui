/* eslint-disable complexity */
import { Fragment, memo, type RefObject, useMemo } from 'react';

import type { AttachmentProgress } from '../../../attachments/application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../../attachments/application/contracts/MessageAttachment';
import type { IdentityResource } from '../../../identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../messages/domain/ChatMessage';
import type { MarkdownMention } from '../../../messages/presentation/components/markdownMessage';
import type { CommunityInvitationNotificationResource } from '../../../notifications/infrastructure/http/resources/CommunityInvitationNotificationResource';
import type { PollSnapshot } from '../../../polls/domain/PollSnapshot';
import type { StickerMessageReference } from '../../../stickers/infrastructure/http/resources/StickerMessageReference';
import type { CommunityChannelThreadSummaryResource as CommunityChannelThreadSummary } from '../../infrastructure/http/resources/CommunityChannelThreadSummaryResource';

import { LockIcon } from '../../../../app/presentation/workspace/components/LockIcon';
import { cx } from '../../../../shared/presentation/cx';
import { formatDateSeparator } from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { IdentityMatch } from '../../../identities/domain/IdentityMatch';
import { DateSeparator } from '../../../messages/presentation/components/DateSeparator';
import { MessageBubble } from '../../../messages/presentation/components/MessageBubble';
import {
  messageReplyImage,
  messageReplySticker,
} from '../../../messages/presentation/components/messageTimelineHelpers';
import {
  messageTimelineEnterClassName,
  messageTimelineEnterStyle,
} from '../../../messages/presentation/components/messageTimelineMotion';
import { TimelineJumpButton } from '../../../messages/presentation/components/TimelineJumpButton';
import { MessageTimelineEntries } from '../../../messages/presentation/view-models/MessageTimelineEntries';
import { InvitationKeyPrompt } from '../../../notifications/presentation/components/InvitationKeyPrompt';
import { PollCard } from '../../../polls/presentation/components/pollCard';
import { CommunityMentionHighlightPolicy } from '../view-models/CommunityMentionHighlightPolicy';
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
  awaitingGroupAccess: boolean;
  invitationAccepting?: boolean;
  invitationError?: null | string;
  invitationInviterName?: string;
  newChannelMessageCount: number;
  onInvitationAccept?: (
    notification: CommunityInvitationNotificationResource,
  ) => void;
  onAttachmentOpen: (attachment?: MessageAttachment) => void;
  onAuthorProfileOpen: (message: ChatMessage, target: HTMLElement) => void;
  onIdentityProfileOpen?: (identityId: string, target: HTMLElement) => void;
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onOpenThread: (message: ChatMessage) => void;
  onReactionToggle: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onPollClose?: (poll: PollSnapshot) => Promise<void>;
  canClosePolls: boolean;
  channelThreadSummaries?: CommunityChannelThreadSummary[];
  onPollRemoveVote?: (poll: PollSnapshot) => Promise<void>;
  onPollVote?: (poll: PollSnapshot, optionIds: string[]) => Promise<void>;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  onScroll: () => void;
  pinnedMessageIds: ReadonlySet<string>;
  currentRoleIds: ReadonlySet<string>;
  reactionAuthorNames: Record<string, string>;
  pendingInvitation?: CommunityInvitationNotificationResource | null;
  polls?: PollSnapshot[];
  scrollerRef: RefObject<HTMLDivElement | null>;
  session: Session;
  visibleMessages: ChatMessage[];
}

export const CommunityMessageTimeline = memo(function CommunityMessageTimeline({
  awaitingGroupAccess,
  bottomRef,
  canClosePolls,
  channelThreadSummaries = [],
  currentRoleIds,
  invitationAccepting = false,
  invitationError,
  invitationInviterName,
  isAwayFromBottom,
  loadAttachmentPreview,
  memberIdentities,
  memberPictures,
  messageCursor,
  messageState,
  newChannelMessageCount,
  onAttachmentOpen,
  onAuthorProfileOpen,
  onIdentityProfileOpen,
  onInvitationAccept,
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
  pendingInvitation,
  pinnedMessageIds,
  polls = [],
  reactionAuthorNames,
  scrollerRef,
  session,
  visibleMessages,
}: CommunityMessageTimelineProps) {
  const timelineEntries = useMemo(
    () =>
      MessageTimelineEntries.build(
        visibleMessages,
        polls,
        channelThreadSummaries.map((summary) => ({
          count: summary.replyCount,
          lastMessage: visibleMessages.find(
            (message) => message.id === summary.lastReplyMessageId,
          ),
          rootMessageId: summary.rootMessageId,
        })),
      ),
    [channelThreadSummaries, polls, visibleMessages],
  );
  const invitationPrompt =
    awaitingGroupAccess && pendingInvitation && onInvitationAccept ? (
      <InvitationKeyPrompt
        accepting={invitationAccepting}
        error={invitationError}
        inviterName={invitationInviterName}
        kind="community"
        onAccept={() => onInvitationAccept(pendingInvitation)}
      />
    ) : null;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full overflow-x-hidden overflow-y-auto p-4 sm:p-6"
      >
        {messageState === 'loading' ? (
          <div className="mx-auto mb-4 w-fit px-4 py-2 text-xs font-black text-white/50">
            {copy.chat.loadingEvents}
          </div>
        ) : null}
        <div>
          {!messageCursor &&
            visibleMessages.length > 0 &&
            messageState !== 'loading' && (
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-white/35">
                <span className="h-px flex-1 bg-white/[0.07]" />
                <span>{copy.chat.noMoreMessages}</span>
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>
            )}
          {awaitingGroupAccess && (
            <>
              {invitationPrompt ?? (
                <div className="grid min-h-[28vh] place-items-center">
                  <div className="w-full max-w-md rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5 text-center text-sm text-amber-100">
                    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15">
                      <LockIcon locked={false} />
                    </div>
                    <div className="font-black">{copy.chat.e2eMissing}</div>
                    <div className="mt-2 text-amber-100/65">
                      {copy.messages.awaitingGroupAccess}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {!awaitingGroupAccess &&
            timelineEntries.map((entry, index) => {
              const enterOrder = timelineEntries.length - index - 1;

              if (entry.type === 'poll') {
                const { item } = entry;
                const mine = IdentityMatch.isSame(
                  item.poll.creatorIdentityId,
                  session.identity.id,
                );

                return (
                  <Fragment key={entry.id}>
                    {entry.startsNewDay && (
                      <DateSeparator
                        label={formatDateSeparator(item.poll.createdAt)}
                      />
                    )}
                    <div
                      data-message-id={item.message.id}
                      className={cx(
                        'mt-4 flex',
                        mine ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <div
                        className={cx(
                          'w-full max-w-xl',
                          messageTimelineEnterClassName(
                            mine ? 'outgoing' : 'incoming',
                          ),
                        )}
                        style={messageTimelineEnterStyle(enterOrder)}
                      >
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
                          onMenuOpen={(x, y) =>
                            onMessageMenuOpen(
                              {
                                ...item.message,
                                mine: IdentityMatch.isSame(
                                  item.poll.creatorIdentityId,
                                  session.identity.id,
                                ),
                              },
                              x,
                              y,
                            )
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

              const message = entry.item.message;
              const replyMessage = entry.replyMessage;

              return (
                <Fragment key={entry.id}>
                  {entry.startsNewDay && (
                    <DateSeparator
                      label={formatDateSeparator(message.timestamp)}
                    />
                  )}
                  <div
                    className={
                      entry.startsNewDay || entry.startsNewAuthorRun
                        ? 'mt-4'
                        : 'mt-1'
                    }
                  >
                    <div
                      className={messageTimelineEnterClassName(
                        message.mine ? 'outgoing' : 'incoming',
                      )}
                      style={messageTimelineEnterStyle(enterOrder)}
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
                        onThreadOpen={onOpenThread}
                        onReactionToggle={onReactionToggle}
                        onReplyReferenceClick={onReplyReferenceClick}
                        onRetryMessage={onRetryMessage}
                        onStickerClick={onStickerClick}
                        pinned={pinnedMessageIds.has(message.id)}
                        reactionAuthorNames={reactionAuthorNames}
                        mentionHighlighted={CommunityMentionHighlightPolicy.mentionsIdentity(
                          message,
                          session.identity.id,
                          currentRoleIds,
                        )}
                        mentionTokens={messageMentionTokens(
                          message,
                          memberIdentities,
                        )}
                        replyImage={messageReplyImage(message, replyMessage)}
                        replySticker={messageReplySticker(
                          message,
                          replyMessage,
                        )}
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
                        showAvatar={entry.endsAuthorRun}
                        threadAuthorName={
                          entry.threadSummary?.lastMessage
                            ? memberPrimaryName(
                                memberIdentities[
                                  entry.threadSummary.lastMessage
                                    .authorIdentityId
                                ],
                                entry.threadSummary.lastMessage
                                  .authorIdentityId,
                              )
                            : undefined
                        }
                        threadAuthorPicture={
                          entry.threadSummary?.lastMessage
                            ? memberPictures[
                                entry.threadSummary.lastMessage.authorIdentityId
                              ]
                            : undefined
                        }
                        threadCount={entry.threadSummary?.count}
                      />
                    </div>
                  </div>
                </Fragment>
              );
            })}
          {timelineEntries.length === 0 && messageState !== 'loading' && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/55">
              {copy.communities.emptyChannel}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      {(newChannelMessageCount > 0 || isAwayFromBottom) && (
        <TimelineJumpButton mode="absolute" onClick={onJumpToLatest}>
          {newChannelMessageCount > 0
            ? newChannelMessageCount > 1
              ? copy.chat.newMessages
              : copy.chat.newMessage
            : copy.chat.jumpToLatest}
        </TimelineJumpButton>
      )}
    </div>
  );
});

function canCloseCommunityPoll(
  poll: PollSnapshot,
  currentIdentityId: string,
  canClosePolls: boolean,
): boolean {
  return canClosePolls || poll.creatorIdentityId === currentIdentityId;
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
