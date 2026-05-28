import { UUID } from '@haskou/value-objects';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  startTransition,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  AttachmentProgress,
  AttachmentUploadOptions,
  ChatMessage,
  Community,
  CommunityMessageMention,
  CommunityPermission,
  CommunityTextChannel,
  IdentityResource,
  MessageReplyPreview,
  MessageResource,
  PollResource,
  Session,
  StickerMessageReference,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { PendingMessageAttachments } from '../../../attachments/domain/PendingMessageAttachments';
import { useAttachmentDownload } from '../../../attachments/presentation/hooks/useAttachmentDownload';
import { MessageLinkPreviews } from '../../../messages/domain/MessageLinkPreviews';
import { MessageReactions } from '../../../messages/domain/MessageReactions';
import { isBrowserPreviewImage } from '../../../../shared/presentation/isBrowserPreviewImage';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import {
  encryptCommunityChannelPayload,
  serializeCommunityChannelPayload,
} from '../../infrastructure/crypto/communityChannelPayloadCipher';
import { mergeChatMessages } from './communityWorkspaceHelpers';
import { CommunityMessageMentions } from './CommunityMessageMentions';

type CommunityPendingSend = {
  attachmentUpload: AttachmentUploadOptions;
  attachments: File[];
  channelId: string;
  content: string;
  mentions?: CommunityMessageMention[];
  replyTarget: ChatMessage | null;
  renderInChannel?: boolean;
  sticker?: StickerMessageReference;
};

type EditingMessage = {
  message: ChatMessage;
  previousDraft: string;
};

type UseCommunityMessageComposerInput = {
  community: Community;
  currentPermissions: Set<CommunityPermission>;
  draft: string;
  memberIdentities: Record<string, IdentityResource>;
  messages: ChatMessage[];
  onTypingActive?: (channelId: string, active: boolean) => void;
  owner: boolean;
  projectChannelMessage: (
    channelId: string,
    message: MessageResource,
  ) => Promise<ChatMessage>;
  scrollChannelToBottom: (behavior?: ScrollBehavior, force?: boolean) => void;
  scrollerRef: RefObject<HTMLDivElement | null>;
  selectedChannel?: CommunityTextChannel;
  selectedChannelId: null | string;
  selectedChannelPolls: PollResource[];
  session: Session;
  setDraft: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

export function useCommunityMessageComposer({
  community,
  currentPermissions,
  draft,
  memberIdentities,
  messages,
  onTypingActive,
  owner,
  projectChannelMessage,
  scrollChannelToBottom,
  scrollerRef,
  selectedChannel,
  selectedChannelId,
  selectedChannelPolls,
  session,
  setDraft,
  setMessages,
}: UseCommunityMessageComposerInput) {
  const communityIsPublic = community.visibility === 'public';
  const [error, setError] = useState<string | null>(null);
  const [attachmentProgress, setAttachmentProgress] =
    useState<AttachmentProgress | null>(null);
  const [editingMessage, setEditingMessage] =
    useState<EditingMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [failedSends, setFailedSends] = useState<
    Record<string, CommunityPendingSend>
  >({});
  const sendQueueRef = useRef(Promise.resolve());

  const { loadAttachmentPreview, openAttachment } = useAttachmentDownload({
    errorMessage: copy.composer.attachmentDownloadError,
    onErrorChange: setError,
    onProgressChange: setAttachmentProgress,
  });

  useEffect(
    () => () => {
      if (selectedChannelId) onTypingActive?.(selectedChannelId, false);
    },
    [onTypingActive, selectedChannelId],
  );

  const mentionsForContent = (content: string): CommunityMessageMention[] =>
    selectedChannel
      ? CommunityMessageMentions.forContent({
          channel: selectedChannel,
          community,
          content,
          identities: memberIdentities,
          permissions: currentPermissions,
        })
      : [];

  const handleSendChannelMessage = (
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
  ): Promise<void> => {
    if (!selectedChannelId) return Promise.resolve();

    onTypingActive?.(selectedChannelId, false);
    void sendPendingChannelMessage({
      attachments,
      attachmentUpload,
      channelId: selectedChannelId,
      content,
      mentions: mentionsForContent(content),
      replyTarget,
    });
    setReplyTarget(null);

    return Promise.resolve();
  };

  const handleSendChannelSticker = (
    sticker: StickerMessageReference,
  ): Promise<void> => {
    if (!selectedChannelId) return Promise.resolve();

    onTypingActive?.(selectedChannelId, false);
    void sendPendingChannelMessage({
      attachments: [],
      attachmentUpload: {},
      channelId: selectedChannelId,
      content: '',
      mentions: [],
      replyTarget,
      sticker,
    });
    setReplyTarget(null);

    return Promise.resolve();
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (selectedChannelId) {
      onTypingActive?.(selectedChannelId, value.trim().length > 0);
    }
  };

  const startEditingChannelMessage = (message: ChatMessage) => {
    if (!selectedChannelId) return;

    setReplyTarget(null);
    setEditingMessage({
      message,
      previousDraft: draft,
    });
    setDraft(message.content);
  };

  const cancelEditingChannelMessage = () => {
    const previousDraft = editingMessage?.previousDraft ?? '';

    setEditingMessage(null);
    setDraft(previousDraft);

    if (selectedChannelId) {
      onTypingActive?.(selectedChannelId, previousDraft.trim().length > 0);
    }
  };

  const editChannelMessage = async (
    message: ChatMessage,
    content: string,
  ): Promise<ChatMessage> => {
    const channelId = message.raw.channelId ?? selectedChannelId;

    if (!channelId) {
      throw new Error(copy.messages.editError);
    }

    const mentions = mentionsForContent(content);

    setError(null);

    const timestamp = Date.now();
    const linkPreview = await createLinkPreviewForContent(session, content);
    const replyToMessageId =
      message.replyToMessageId ?? message.raw.replyToMessageId;
    const payloadInput = {
      attachments: message.attachments,
      authorIdentityId: session.identity.id,
      channelId,
      communityId: community.id,
      content,
      eventType: 'CommunityChannelMessageEdited' as const,
      linkPreview,
      mentions,
      replyPreview: message.replyPreview,
      replyToMessageId,
      timestamp,
    };
    const messagePayload = communityIsPublic
      ? { plaintextPayload: serializeCommunityChannelPayload(payloadInput) }
      : {
          encryptedPayload: await encryptCommunityChannelPayload({
            ...payloadInput,
            communityKey: session.keychain.conversations[community.id],
          }),
        };
    const edited = await applicationContainer.editCommunityChannelMessage(
      session,
      community.id,
      channelId,
      message.id,
      {
        attachmentExternalIdentifiers: message.attachments.map(
          (attachment) => attachment.cid,
        ),
        ...messagePayload,
        mentions,
        timestamp,
      },
    );

    return await projectChannelMessage(channelId, edited);
  };

  const handleEditChannelMessage = async (content: string) => {
    if (!selectedChannelId || !editingMessage) return;

    const targetMessage = editingMessage.message;

    try {
      const projected = await editChannelMessage(targetMessage, content);

      setMessages((current) => mergeChatMessages(current, [projected]));
      setEditingMessage(null);
      setDraft('');
      onTypingActive?.(targetMessage.raw.channelId ?? selectedChannelId, false);
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.messages.editError));
    }
  };

  const retryChannelMessage = (message: ChatMessage) => {
    const pending = failedSends[message.id];

    if (!pending) return;

    setMessages((current) => current.filter((item) => item.id !== message.id));
    void sendPendingChannelMessage(pending);
  };

  const handleReplyReferenceClick = (messageId: string) => {
    if (
      messages.some((message) => message.id === messageId) ||
      selectedChannelPolls.some((poll) => poll.id === messageId)
    ) {
      scrollToChannelMessage(messageId);

      return;
    }

    setError(copy.messages.replyTargetNotFound);
  };

  const deleteChannelMessage = async (message: ChatMessage): Promise<boolean> => {
    const channelId = message.raw.channelId ?? selectedChannelId;

    if (
      !channelId ||
      (!message.mine && !owner && !currentPermissions.has('manage_messages'))
    ) {
      return false;
    }

    setError(null);
    await applicationContainer.deleteCommunityChannelMessage(
      session,
      community.id,
      channelId,
      message.id,
    );

    return true;
  };

  const handleDeleteChannelMessage = async (message: ChatMessage) => {
    if (
      !selectedChannelId ||
      (!message.mine && !owner && !currentPermissions.has('manage_messages'))
    )
      return;

    if (!window.confirm(copy.messages.deleteConfirm)) return;

    try {
      const deleted = await deleteChannelMessage(message);

      if (!deleted) return;

      setMessages((current) =>
        current.filter((item) => item.id !== message.id),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.messages.deleteError));
    }
  };

  const handleToggleChannelMessageReaction = async (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => {
    if (!selectedChannelId) return;

    const channelId = selectedChannelId;

    setError(null);
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? MessageReactions.update(
              item,
              session.identity.id,
              emoji,
              reacted ? 'remove' : 'add',
            )
          : item,
      ),
    );

    try {
      if (reacted) {
        await applicationContainer.removeCommunityChannelMessageReaction(
          session,
          community.id,
          channelId,
          message.id,
          emoji,
        );
      } else {
        await applicationContainer.addCommunityChannelMessageReaction(
          session,
          community.id,
          channelId,
          message.id,
          emoji,
        );
      }
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.messages.reactionError));
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? MessageReactions.update(
                item,
                session.identity.id,
                emoji,
                reacted ? 'add' : 'remove',
              )
            : item,
        ),
      );
    }
  };

  const startReplyToMessage = (message: ChatMessage) => {
    setReplyTarget(message);
    setEditingMessage(null);
  };

  const clearReplyTarget = () => {
    setReplyTarget(null);
  };

  const resetForChannelChange = () => {
    setReplyTarget(null);
    setEditingMessage(null);
    setError(null);
  };

  const sendPendingChannelMessage = (
    payload: CommunityPendingSend,
  ): Promise<ChatMessage> => {
    setError(null);
    const timestamp = Date.now();
    const optimisticId = `pending:${community.id}:${payload.channelId}:${timestamp}:${UUID.generate().toString()}`;
    const renderInChannel = payload.renderInChannel ?? true;

    setFailedSends((current) => {
      const next = { ...current };

      delete next[optimisticId];

      return next;
    });
    if (renderInChannel) {
      setMessages((current) => [
        ...current,
        {
          attachments: PendingMessageAttachments.fromFiles(
            payload.attachments,
            optimisticId,
          ),
          authorIdentityId: session.identity.id,
          content: payload.sticker
            ? ''
            : payload.content ||
              payload.attachments.map((attachment) => attachment.name).join(', '),
          deliveryStatus: 'pending',
          encrypted: false,
          id: optimisticId,
          mentions: payload.mentions,
          mine: true,
          raw: {
            channelId: payload.channelId,
            communityId: community.id,
            id: optimisticId,
            mentions: payload.mentions,
            type: 'sent',
          },
          reactions: [],
          replyPreview: replyPreviewFromMessage(payload.replyTarget),
          replyToMessageId: payload.replyTarget?.id,
          sticker: payload.sticker,
          timestamp,
        },
      ]);
      scrollChannelToBottom('smooth');
    }

    const delivery = sendQueueRef.current.then(async () => {
      try {
        const messageAttachments =
          await applicationContainer.publishMessageAttachments(
            session,
            payload.attachments,
            (progress) => {
              startTransition(() => {
                setMessages((current) =>
                  current.map((message) =>
                    message.id === optimisticId
                      ? { ...message, attachmentProgress: progress }
                      : message,
                  ),
                );
              });
            },
            payload.attachmentUpload,
          );
        const linkPreview = payload.sticker
          ? undefined
          : await createLinkPreviewForContent(session, payload.content);
        const payloadInput = {
          attachments: messageAttachments,
          authorIdentityId: session.identity.id,
          channelId: payload.channelId,
          communityId: community.id,
          content: payload.content,
          linkPreview,
          mentions: payload.mentions,
          replyPreview: replyPreviewFromMessage(payload.replyTarget),
          replyToMessageId: payload.replyTarget?.id,
          sticker: payload.sticker,
          timestamp,
        };
        const messagePayload = communityIsPublic
          ? { plaintextPayload: serializeCommunityChannelPayload(payloadInput) }
          : {
              encryptedPayload: await encryptCommunityChannelPayload({
                ...payloadInput,
                communityKey: session.keychain.conversations[community.id],
              }),
            };
        const created =
          await applicationContainer.createCommunityChannelMessage(
            session,
            community.id,
            payload.channelId,
            {
              attachmentExternalIdentifiers: messageAttachments.map(
                (attachment) => attachment.cid,
              ),
              ...messagePayload,
              mentions: payload.mentions,
              replyToMessageId: payload.replyTarget?.id,
              timestamp,
            },
          );
        const projected = await projectChannelMessage(
          payload.channelId,
          created,
        );

        if (payload.sticker) {
          void applicationContainer.markStickerUsed(session, payload.sticker);
        }

        if (renderInChannel) {
          setMessages((current) =>
            mergeChatMessages(
              current.filter((message) => message.id !== optimisticId),
              [projected],
            ),
          );
          scrollChannelToBottom('smooth', true);
        }

        return projected;
      } catch (caught) {
        setError(toUserErrorMessage(caught, copy.communities.messageError));
        setFailedSends((current) => ({ ...current, [optimisticId]: payload }));
        if (renderInChannel) {
          setMessages((current) =>
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
        throw caught;
      }
    });

    sendQueueRef.current = delivery.catch(() => undefined).then(() => undefined);

    return delivery;
  };

  const sendReplyToMessage = (
    message: ChatMessage,
    content: string,
    attachments: File[],
    attachmentUpload: AttachmentUploadOptions,
    options: { renderInChannel?: boolean } = {},
  ): Promise<ChatMessage | null> => {
    const channelId = message.raw.channelId ?? selectedChannelId;

    if (!channelId) return Promise.resolve(null);

    return sendPendingChannelMessage({
      attachments,
      attachmentUpload,
      channelId,
      content,
      mentions: selectedChannel ? mentionsForContent(content) : [],
      renderInChannel: options.renderInChannel,
      replyTarget: message,
    });
  };

  const sendStickerReplyToMessage = (
    message: ChatMessage,
    sticker: StickerMessageReference,
    options: { renderInChannel?: boolean } = {},
  ): Promise<ChatMessage | null> => {
    const channelId = message.raw.channelId ?? selectedChannelId;

    if (!channelId) return Promise.resolve(null);

    return sendPendingChannelMessage({
      attachments: [],
      attachmentUpload: {},
      channelId,
      content: '',
      mentions: [],
      renderInChannel: options.renderInChannel,
      replyTarget: message,
      sticker,
    });
  };

  const scrollToChannelMessage = (messageId: string) => {
    requestAnimationFrame(() => {
      const element = scrollerRef.current?.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(messageId)}"]`,
      );

      if (!element) return;

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusTarget =
        element.querySelector<HTMLElement>('[data-message-bubble]') ?? element;

      focusTarget.classList.add('message-focus-ring');
      window.setTimeout(
        () => focusTarget.classList.remove('message-focus-ring'),
        1600,
      );
    });
  };

  return {
    attachmentProgress,
    cancelEditingChannelMessage,
    clearReplyTarget,
    deleteChannelMessage,
    draft,
    editChannelMessage,
    editingMessage: editingMessage?.message ?? null,
    error,
    handleDeleteChannelMessage,
    handleDraftChange,
    handleEditChannelMessage,
    handleReplyReferenceClick,
    handleSendChannelMessage,
    handleSendChannelSticker,
    handleToggleChannelMessageReaction,
    loadAttachmentPreview,
    openAttachment,
    replyTarget,
    resetForChannelChange,
    retryChannelMessage,
    sendReplyToMessage,
    sendStickerReplyToMessage,
    setError,
    startEditingChannelMessage,
    startReplyToMessage,
  };
}

function replyPreviewFromMessage(
  message?: ChatMessage | null,
): MessageReplyPreview | undefined {
  if (!message) return undefined;

  const image = message.attachments.find((attachment) =>
    isBrowserPreviewImage(attachment.contentType),
  );

  return {
    authorIdentityId: message.authorIdentityId,
    ...(message.content ? { content: message.content.slice(0, 180) } : {}),
    ...(image ? { image } : {}),
    messageId: message.id,
    ...(message.sticker ? { sticker: message.sticker } : {}),
  };
}

async function createLinkPreviewForContent(session: Session, content: string) {
  const url = MessageLinkPreviews.firstUrl(content);

  if (!url) return undefined;

  return await applicationContainer
    .createLinkPreview(session, url)
    .catch(() => undefined);
}
