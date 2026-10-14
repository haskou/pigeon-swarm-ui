import type { ReactNode, RefObject } from 'react';

import type { AttachmentProgress } from '../../../../contexts/attachments/application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../../../contexts/attachments/application/contracts/MessageAttachment';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { ChatMessage } from '../../../../contexts/messages/domain/ChatMessage';
import type { PollSnapshot } from '../../../../contexts/polls/domain/PollSnapshot';
import type { StickerMessageReference } from '../../../../contexts/stickers/infrastructure/http/resources/StickerMessageReference';
import type { LoadState } from './LoadState';

export interface ChatMessageTimelineProps {
  bottomRef: RefObject<HTMLDivElement | null>;
  currentIdentityId: string;
  currentIdentityName: string;
  hasConversationKey: boolean;
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  isGroupConversation: boolean;
  loadAttachmentPreview: (
    attachment: MessageAttachment,
    onProgress?: (progress: AttachmentProgress) => void,
  ) => Promise<string>;
  missingConversationKeyContent?: ReactNode;
  messageState: LoadState;
  messages: ChatMessage[];
  newMessageCount: number;
  onAttachmentOpen: (attachment?: MessageAttachment) => void;
  onAuthorProfileOpen: (
    message: ChatMessage,
    target: HTMLElement | null,
  ) => void;
  onJumpToLatest: () => void;
  onMessageMenuOpen: (message: ChatMessage, x: number, y: number) => void;
  onOpenThread?: (message: ChatMessage) => void;
  onReactionToggle: (
    message: ChatMessage,
    emoji: string,
    reacted: boolean,
  ) => void;
  onReplyReferenceClick: (messageId: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onPollClose?: (poll: PollSnapshot) => Promise<void>;
  onPollRemoveVote?: (poll: PollSnapshot) => Promise<void>;
  onPollVote?: (poll: PollSnapshot, optionIds: string[]) => Promise<void>;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  onScroll: () => void;
  pinnedMessageIds: ReadonlySet<string>;
  reactionAuthorNames: Record<string, string>;
  polls?: PollSnapshot[];
  scrollerRef: RefObject<HTMLDivElement | null>;
}
