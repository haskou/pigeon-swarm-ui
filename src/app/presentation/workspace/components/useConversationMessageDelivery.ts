import { UUID } from '@haskou/value-objects';
import {
  startTransition,
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  ConversationResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';
import type { DirectMessageMailboxDelivery } from '../../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';

import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { PendingConversationMessage } from './PendingConversationMessage';
import { runMailboxSideEffect } from './runMailboxSideEffect';

export type PendingConversationSend = {
  attachmentUpload: AttachmentUploadOptions;
  attachments: File[];
  content: string;
  replyTarget: ChatMessage | null;
  sticker?: StickerMessageReference;
};

type ConversationMessageDeliveryInput = {
  activeConversation: ConversationResource | undefined;
  messagesRef: RefObject<ChatMessage[]>;
  onAttachmentProgressChange: (progress: AttachmentProgress | null) => void;
  onConversationsChange: Dispatch<SetStateAction<ConversationResource[]>>;
  onErrorChange: (error: string | null) => void;
  onMessagesChange: Dispatch<SetStateAction<ChatMessage[]>>;
  onReplyTargetChange: (message: ChatMessage | null) => void;
  replyTarget: ChatMessage | null;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  session: Session;
};

type ConversationMessageDelivery = {
  retryMessage: (message: ChatMessage) => void;
  sendMessage: (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ) => Promise<void>;
  sendSticker: (sticker: StickerMessageReference) => Promise<void>;
};

export function useConversationMessageDelivery({
  activeConversation,
  messagesRef,
  onAttachmentProgressChange,
  onConversationsChange,
  onErrorChange,
  onMessagesChange,
  onReplyTargetChange,
  replyTarget,
  scrollToBottom,
  session,
}: ConversationMessageDeliveryInput): ConversationMessageDelivery {
  const [failedSends, setFailedSends] = useState<
    Record<string, PendingConversationSend>
  >({});
  // Conversation whose direct copy notice is in the error slot, if any.
  const directCopyNoticeConversationRef = useRef<string | null>(null);
  // Latest active conversation, read when an asynchronous copy outcome lands.
  const activeConversationIdRef = useRef(activeConversation?.id);

  activeConversationIdRef.current = activeConversation?.id;

  const sendQueueRef = useRef(Promise.resolve());

  const reportDirectCopyOutcome = useCallback(
    (conversationId: string, outcome: DirectMessageMailboxDelivery) => {
      // A skipped copy never reached the mailbox, so it changes nothing here.
      if (outcome === 'skipped') return;

      const isActive = activeConversationIdRef.current === conversationId;

      if (outcome === 'failed') {
        if (!isActive) return;

        directCopyNoticeConversationRef.current = conversationId;
        onErrorChange(copy.workspace.directMailboxDeliveryError);

        return;
      }

      if (directCopyNoticeConversationRef.current !== conversationId) return;

      directCopyNoticeConversationRef.current = null;

      if (isActive) onErrorChange(null);
    },
    [onErrorChange],
  );

  const sendPendingMessage = useCallback(
    (payload: PendingConversationSend) => {
      if (!activeConversation?.id) return;

      const conversationId = activeConversation.id;
      const optimisticTimestamp = Date.now();
      const optimisticId = `pending:${conversationId}:${optimisticTimestamp}:${UUID.generate().toString()}`;

      // Keep a showing copy notice for this conversation while its next send runs.
      if (directCopyNoticeConversationRef.current !== conversationId) {
        directCopyNoticeConversationRef.current = null;
        onErrorChange(null);
      }
      onAttachmentProgressChange(null);
      onConversationsChange((current) =>
        ConversationTimeline.bumpActivity(
          current,
          conversationId,
          optimisticTimestamp,
        ),
      );
      setFailedSends((current) => {
        const next = { ...current };

        delete next[optimisticId];

        return next;
      });
      onMessagesChange((current) => [
        ...current,
        PendingConversationMessage.create({
          attachments: payload.attachments,
          authorIdentityId: session.identity.id,
          content: payload.content,
          id: optimisticId,
          replyTarget: payload.replyTarget,
          sticker: payload.sticker,
          timestamp: optimisticTimestamp,
        }),
      ]);
      scrollToBottom('smooth');

      sendQueueRef.current = sendQueueRef.current.then(async () => {
        try {
          const lastMessageId = MessageCollection.lastDeliveredMessageTarget(
            messagesRef.current,
          )?.id;
          const sent = await applicationContainer.messages.send(
            session,
            conversationId,
            payload.content,
            {
              attachments: payload.attachments,
              attachmentUpload: {
                ...payload.attachmentUpload,
                networkId: activeConversation.networkId,
              },
              onAttachmentProgress: (progress) => {
                startTransition(() => {
                  onMessagesChange((current) =>
                    current.map((message) =>
                      message.id === optimisticId
                        ? { ...message, attachmentProgress: progress }
                        : message,
                    ),
                  );
                });
              },
              previousMessageIds: lastMessageId ? [lastMessageId] : [],
              replyPreview: replyPreviewFromMessage(payload.replyTarget),
              replyToMessageId: payload.replyTarget?.id,
              sticker: payload.sticker,
            },
          );

          const sticker = payload.sticker;

          if (sticker) {
            runStickerUsageSideEffect(() =>
              applicationContainer.stickers.markUsed(session, sticker),
            );
          }

          runMailboxSideEffect(
            () =>
              applicationContainer.directMessages.deliverSent(
                session,
                activeConversation,
                sent.raw,
              ),
            (outcome) => reportDirectCopyOutcome(conversationId, outcome),
          );

          onMessagesChange((current) =>
            MessageCollection.merge(
              current.filter((message) => message.id !== optimisticId),
              [sent],
            ),
          );
          onConversationsChange((current) =>
            ConversationTimeline.bumpActivity(
              current,
              conversationId,
              sent.timestamp,
            ),
          );
          scrollToBottom('smooth');
        } catch (caught) {
          directCopyNoticeConversationRef.current = null;
          onErrorChange(toUserErrorMessage(caught, copy.workspace.sendError));
          setFailedSends((current) => ({
            ...current,
            [optimisticId]: payload,
          }));
          onMessagesChange((current) =>
            current.map((message) =>
              message.id === optimisticId
                ? {
                    ...message,
                    attachmentProgress: undefined,
                    deliveryStatus: 'failed',
                  }
                : message,
            ),
          );
        }
      });
    },
    [
      activeConversation,
      messagesRef,
      onAttachmentProgressChange,
      onConversationsChange,
      onErrorChange,
      onMessagesChange,
      reportDirectCopyOutcome,
      scrollToBottom,
      session,
    ],
  );

  const sendMessage = useCallback(
    (
      content: string,
      attachments: File[],
      attachmentUpload: AttachmentUploadOptions,
    ): Promise<void> => {
      sendPendingMessage({
        attachments,
        attachmentUpload,
        content,
        replyTarget,
      });
      onReplyTargetChange(null);

      return Promise.resolve();
    },
    [onReplyTargetChange, replyTarget, sendPendingMessage],
  );

  const sendSticker = useCallback(
    (sticker: StickerMessageReference): Promise<void> => {
      sendPendingMessage({
        attachments: [],
        attachmentUpload: {},
        content: '',
        replyTarget,
        sticker,
      });
      onReplyTargetChange(null);

      return Promise.resolve();
    },
    [onReplyTargetChange, replyTarget, sendPendingMessage],
  );

  const retryMessage = useCallback(
    (message: ChatMessage) => {
      const payload = failedSends[message.id];

      if (!payload) return;

      setFailedSends((current) => {
        const next = { ...current };

        delete next[message.id];

        return next;
      });
      onMessagesChange((current) =>
        current.filter((item) => item.id !== message.id),
      );
      sendPendingMessage(payload);
    },
    [failedSends, onMessagesChange, sendPendingMessage],
  );

  return { retryMessage, sendMessage, sendSticker };
}

/**
 * Runs a sticker usage write after a send has been delivered. The write is
 * local bookkeeping, so its failure must never mark the delivered send failed,
 * skip the inbox copy, or leave a rejection unhandled. The effect starts
 * synchronously. A synchronous throw or a rejection is contained and logged
 * count-only.
 */
function runStickerUsageSideEffect(effect: () => unknown): void {
  const logFailure = (): void => {
    // Count-only: no ids, content, or error details.
    // eslint-disable-next-line no-console
    console.debug('Sticker usage side effect failed; delivered send kept.');
  };

  try {
    Promise.resolve(effect()).catch(logFailure);
  } catch {
    logFailure();
  }
}
