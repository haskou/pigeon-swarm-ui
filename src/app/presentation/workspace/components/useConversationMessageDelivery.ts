import { UUID } from '@haskou/value-objects';
import { startTransition, useCallback, useRef } from 'react';

import type { AttachmentUploadOptions } from '../../../../contexts/attachments/application/contracts/AttachmentUploadOptions';
import type { SendMessageOptions } from '../../../../contexts/messages/infrastructure/http/resources/SendMessageOptions';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { StickerMessageReference } from '../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';
import type { ConversationMessageDelivery } from './ConversationMessageDelivery';
import type { ConversationMessageDeliveryInput } from './ConversationMessageDeliveryInput';

import { ConversationPeer } from '../../../../contexts/conversations/presentation/view-models/ConversationPeer';
import { ConversationTimeline } from '../../../../contexts/conversations/presentation/view-models/ConversationTimeline';
import { MessageCollection } from '../../../../contexts/messages/presentation/view-models/MessageCollection';
import { replyPreviewFromMessage } from '../../../../contexts/messages/presentation/view-models/replyPreviewFromMessage';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { patchMessageById } from './patchMessageById';
import { PendingConversationMessage } from './PendingConversationMessage';
import { runStickerUsageSideEffect } from './runStickerUsageSideEffect';
import { withoutMessageById } from './withoutMessageById';

export type PendingConversationSend = {
  attachmentUpload: AttachmentUploadOptions;
  attachments: File[];
  content: string;
  replyTarget: ChatMessage | null;
  sticker?: StickerMessageReference;
};

/**
 * Stamps a one-to-one message with the state of its send while the outbox
 * still holds that send. A delivered send carries no state.
 */
function withQueuedState(
  identityId: string,
  conversationId: string,
  message: ChatMessage,
): ChatMessage {
  const state = applicationContainer.directMessages
    .outboxItems(identityId, conversationId)
    .find((item) => item.id === message.id)?.state;

  return state ? { ...message, deliveryStatus: state } : message;
}

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
  // A ref: a retry reads the payload of a failed send at once, not on a later
  // render.
  const failedSendsRef = useRef(new Map<string, PendingConversationSend>());

  const sendQueueRef = useRef(Promise.resolve());

  const sendPendingMessage = useCallback(
    (
      payload: PendingConversationSend,
      identity?: { createdAt: number; id: string },
    ) => {
      if (!activeConversation?.id) return;

      const conversationId = activeConversation.id;
      const direct = activeConversation.type === 'one-to-one';
      const optimisticTimestamp = identity?.createdAt ?? Date.now();
      // A one-to-one optimistic id is the mailbox record id, so a retry keeps
      // the id it had.
      const optimisticId =
        identity?.id ??
        (direct
          ? UUID.generate().toString()
          : `pending:${conversationId}:${optimisticTimestamp}:${UUID.generate().toString()}`);

      onErrorChange(null);
      onAttachmentProgressChange(null);
      onConversationsChange((current) =>
        ConversationTimeline.bumpActivity(
          current,
          conversationId,
          optimisticTimestamp,
        ),
      );
      failedSendsRef.current.delete(optimisticId);
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

      const deliverPendingMessage = async () => {
        try {
          const lastMessageId = MessageCollection.lastDeliveredMessageTarget(
            messagesRef.current,
          )?.id;
          const sendOptions: SendMessageOptions = {
            attachments: payload.attachments,
            attachmentUpload: {
              ...payload.attachmentUpload,
              networkId: activeConversation.networkId,
              recipientIdentityId: ConversationPeer.identityId(
                activeConversation,
                session.identity.id,
              ),
            },
            onAttachmentProgress: (progress) => {
              startTransition(() => {
                onMessagesChange(
                  patchMessageById(optimisticId, {
                    attachmentProgress: progress,
                  }),
                );
              });
            },
            previousMessageIds: lastMessageId ? [lastMessageId] : [],
            replyPreview: replyPreviewFromMessage(payload.replyTarget),
            replyToMessageId: payload.replyTarget?.id,
            sticker: payload.sticker,
          };
          // One-to-one traffic goes only through the mailbox; groups keep the
          // legacy message endpoint.
          const sent = direct
            ? await applicationContainer.directMessages.send(
                session,
                activeConversation,
                payload.content,
                sendOptions,
                { createdAt: optimisticTimestamp, id: optimisticId },
              )
            : await applicationContainer.messages.send(
                session,
                conversationId,
                payload.content,
                sendOptions,
              );

          const sticker = payload.sticker;

          if (sticker) {
            runStickerUsageSideEffect(() =>
              applicationContainer.stickers.markUsed(session, sticker),
            );
          }

          const merged = direct
            ? withQueuedState(session.identity.id, conversationId, sent)
            : sent;

          onMessagesChange((current) =>
            MessageCollection.merge(withoutMessageById(current, optimisticId), [
              merged,
            ]),
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
          failedSendsRef.current.set(optimisticId, payload);
          onMessagesChange(
            patchMessageById(optimisticId, {
              attachmentProgress: undefined,
              deliveryStatus: 'failed',
            }),
          );
        }
      };

      if (direct) {
        // Each one-to-one send is persisted on its own, so none waits for an
        // earlier one.
        void deliverPendingMessage();
      } else {
        sendQueueRef.current = sendQueueRef.current.then(deliverPendingMessage);
      }
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

  // The outbox re-queues a one-to-one send it holds. Otherwise the send goes
  // again under the same record id.
  const retryDirectMessage = useCallback(
    async (message: ChatMessage): Promise<void> => {
      if (!activeConversation) return;

      onErrorChange(null);

      try {
        const retried = await applicationContainer.directMessages.retry(
          session,
          activeConversation,
          message.id,
        );

        if (retried) {
          failedSendsRef.current.delete(message.id);
          const queued = withQueuedState(
            session.identity.id,
            activeConversation.id,
            retried,
          );

          onMessagesChange((current) =>
            MessageCollection.merge(withoutMessageById(current, message.id), [
              queued,
            ]),
          );

          return;
        }
      } catch (caught) {
        onErrorChange(toUserErrorMessage(caught, copy.workspace.sendError));

        return;
      }

      const payload = failedSendsRef.current.get(message.id);

      if (!payload) return;

      failedSendsRef.current.delete(message.id);
      onMessagesChange((current) => withoutMessageById(current, message.id));
      sendPendingMessage(payload, {
        createdAt: message.timestamp,
        id: message.id,
      });
    },
    [
      activeConversation,
      onErrorChange,
      onMessagesChange,
      sendPendingMessage,
      session,
    ],
  );

  const retryMessage = useCallback(
    (message: ChatMessage) => {
      if (activeConversation?.type === 'one-to-one') {
        void retryDirectMessage(message);

        return;
      }

      const payload = failedSendsRef.current.get(message.id);

      if (!payload) return;

      failedSendsRef.current.delete(message.id);
      onMessagesChange((current) => withoutMessageById(current, message.id));
      sendPendingMessage(payload);
    },
    [
      activeConversation,
      onMessagesChange,
      retryDirectMessage,
      sendPendingMessage,
    ],
  );

  return { retryMessage, sendMessage, sendSticker };
}
