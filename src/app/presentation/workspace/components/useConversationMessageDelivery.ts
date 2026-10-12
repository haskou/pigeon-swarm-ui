import { UUID } from '@haskou/value-objects';
import { startTransition, useCallback, useRef, useState } from 'react';

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
          const sent =
            activeConversation.type === 'one-to-one'
              ? await applicationContainer.directMessages.send(
                  session,
                  activeConversation,
                  payload.content,
                  sendOptions,
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

          onMessagesChange((current) =>
            MessageCollection.merge(withoutMessageById(current, optimisticId), [
              sent,
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
          setFailedSends((current) => ({
            ...current,
            [optimisticId]: payload,
          }));
          onMessagesChange(
            patchMessageById(optimisticId, {
              attachmentProgress: undefined,
              deliveryStatus: 'failed',
            }),
          );
        }
      };

      sendQueueRef.current = sendQueueRef.current.then(deliverPendingMessage);
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
      onMessagesChange((current) => withoutMessageById(current, message.id));
      sendPendingMessage(payload);
    },
    [failedSends, onMessagesChange, sendPendingMessage],
  );

  return { retryMessage, sendMessage, sendSticker };
}
