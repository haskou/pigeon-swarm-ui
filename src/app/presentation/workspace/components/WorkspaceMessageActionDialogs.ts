import type { MessageAttachment } from '../../../../contexts/attachments/application/contracts/MessageAttachment';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { MessageContextMenuState } from './messageContextMenu';

export type WorkspaceMessageActionDialogs = {
  activeConversation?: ConversationResource;
  menu: MessageContextMenuState | null;
  onCloseMenu: () => void;
  onCloseRawMessage: () => void;
  onCopy: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onDownloadAttachment: (attachment: MessageAttachment) => void;
  onEdit: (message: ChatMessage) => void;
  onOpenThread: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onToggleReaction: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onUnpin: (message: ChatMessage) => void;
  onViewRaw: (message: ChatMessage) => void;
  pinnedMessageIds: ReadonlySet<string>;
  rawMessage: ChatMessage | null;
  session: Session;
};
