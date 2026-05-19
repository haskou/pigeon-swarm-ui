import { Fragment, memo, type RefObject } from 'react';

import type {
  AttachmentProgress,
  ChatMessage,
  IdentityResource,
  MessageAttachment,
  Session,
  StickerMessageReference,
} from '../../domain/types';

import { copy } from '../../i18n/en';
import { formatDateSeparator } from '../../utils/formatting';
import { DateSeparator } from '../chat/DateSeparator';
import { MessageBubble } from '../chat/MessageBubble';
import { MessageListSkeleton } from '../chat/MessageListSkeleton';
import {
  endsAuthorRun,
  findReplyMessage,
  messageReplyImage,
  startsAuthorRun,
  startsMessageDay,
} from '../chat/messageTimelineHelpers';
import { LockIcon } from '../workspace/LockIcon';
import { memberDisplayName } from './communityMemberNames';

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
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onReactionToggle: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  onScroll: () => void;
  reactionAuthorNames: Record<string, string>;
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
  onJumpToLatest,
  onMessageMenuOpen,
  onReactionToggle,
  onReplyReferenceClick,
  onRetryMessage,
  onStickerClick,
  onScroll,
  reactionAuthorNames,
  scrollerRef,
  session,
  visibleMessages,
}: CommunityMessageTimelineProps) {
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
            visibleMessages.map((message, index) => {
              const previousMessage = visibleMessages[index - 1];
              const nextMessage = visibleMessages[index + 1];
              const replyMessage = findReplyMessage(visibleMessages, message);
              const startsNewDay = startsMessageDay(previousMessage, message);
              const startsNewAuthorRun = startsAuthorRun(
                previousMessage,
                message,
              );
              const showAvatar = endsAuthorRun(nextMessage, message);

              return (
                <Fragment key={message.id}>
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
                      onReactionToggle={onReactionToggle}
                      onReplyReferenceClick={onReplyReferenceClick}
                      onRetryMessage={onRetryMessage}
                      onStickerClick={onStickerClick}
                      reactionAuthorNames={reactionAuthorNames}
                      replyImage={messageReplyImage(message, replyMessage)}
                      replyAuthorName={
                        replyMessage
                          ? memberDisplayName(
                              memberIdentities[replyMessage.authorIdentityId],
                              replyMessage.authorIdentityId,
                            )
                          : message.replyPreview
                            ? memberDisplayName(
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
          {visibleMessages.length === 0 && messageState !== 'loading' && (
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
