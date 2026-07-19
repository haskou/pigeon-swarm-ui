import type { IdentityNames } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';
import type { ChatColumnProps } from './ChatColumnProps';

import { identityDisplayName } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import { Composer } from '../../../../contexts/messages/presentation/components/Composer';
import { copy } from '../../../../shared/presentation/i18n/copy';

function composerPlaceholder(
  hasConversationKey: boolean,
  hasPendingInvitation: boolean,
): string {
  return hasConversationKey || hasPendingInvitation
    ? copy.composer.placeholder
    : copy.messages.missingConversationKey;
}

function replyAuthorName(
  replyToMessage: ChatMessage | null | undefined,
  identityNames: IdentityNames,
): string | undefined {
  return replyToMessage
    ? identityDisplayName(replyToMessage.authorIdentityId, identityNames)
    : undefined;
}

export function ChatConversationComposer({
  activeConversationId,
  attachmentError,
  canCreatePoll,
  downloadProgress,
  draft,
  editingMessage,
  hasConversationKey,
  hasPendingInvitation,
  identityNames,
  messageState,
  onCancelEdit,
  onCancelReply,
  onDraftChange,
  onEditMessage,
  onEscape,
  onPollCreate,
  onSend,
  onStickerSend,
  onTypingActive,
  progress,
  replyToMessage,
  sendError,
  session,
}: Pick<
  ChatColumnProps,
  | 'draft'
  | 'editingMessage'
  | 'hasConversationKey'
  | 'identityNames'
  | 'messageState'
  | 'onCancelEdit'
  | 'onCancelReply'
  | 'onDraftChange'
  | 'onEditMessage'
  | 'onEscape'
  | 'onSend'
  | 'onStickerSend'
  | 'onTypingActive'
  | 'progress'
  | 'replyToMessage'
  | 'sendError'
  | 'session'
> & {
  activeConversationId: string;
  attachmentError: string | null;
  canCreatePoll: boolean;
  downloadProgress: ChatColumnProps['progress'];
  hasPendingInvitation: boolean;
  onPollCreate: () => void;
}) {
  const handleDraftChange = (value: string) => {
    onDraftChange(value);
    onTypingActive?.(value.trim().length > 0);
  };
  const handleSend: ChatColumnProps['onSend'] = async (...input) => {
    onTypingActive?.(false);
    await onSend(...input);
  };
  const handleEditMessage = async (content: string) => {
    onTypingActive?.(false);
    await onEditMessage(content);
  };

  return (
    <Composer
      attachmentEncryptionAvailable={hasConversationKey}
      disabled={messageState === 'loading' || !hasConversationKey}
      draft={draft}
      editingMessage={editingMessage}
      error={sendError ?? attachmentError}
      focusKey={`${activeConversationId}:${editingMessage?.id ?? 'send'}`}
      onCancelEdit={onCancelEdit}
      onDraftChange={handleDraftChange}
      onEdit={handleEditMessage}
      onEscape={onEscape}
      onSend={handleSend}
      onStickerSend={onStickerSend}
      onPollCreate={canCreatePoll ? onPollCreate : undefined}
      onCancelReply={onCancelReply}
      progress={downloadProgress ?? progress}
      placeholder={composerPlaceholder(
        hasConversationKey,
        hasPendingInvitation,
      )}
      replyTo={replyToMessage}
      replyToAuthorName={replyAuthorName(replyToMessage, identityNames)}
      session={session}
    />
  );
}
