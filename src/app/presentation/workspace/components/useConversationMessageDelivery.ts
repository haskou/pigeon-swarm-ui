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

import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { PendingConversationMessage } from './PendingConversationMessage';

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
  const sendQueueRef = useRef(Promise.resolve());

  const sendPendingMessage = useCallback(
    (payload: PendingConversationSend) => {
      if (!activeConversation?.id) return;

      const conversationId = activeConversation.id;
      const optimisticTimestamp = Date.now();
      const optimisticId = `pending:${conversationId}:${optimisticTimestamp}:${UUID.generate().toString()}`;

      onErrorChange(null);
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

          if (payload.sticker) {
            void applicationContainer.stickers.markUsed(
              session,
              payload.sticker,
            );
          }

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
