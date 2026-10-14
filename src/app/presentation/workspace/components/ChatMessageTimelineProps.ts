import type { ReactNode, RefObject } from 'react';

import type { AttachmentProgress } from '../../../../contexts/attachments/application/contracts/AttachmentProgress';
import type { MessageAttachment } from '../../../../contexts/attachments/application/contracts/MessageAttachment';
import type {
  IdentityNames,
  IdentityPictures,
} from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { ChatMessage } from '../../../../contexts/messages/presentation/view-models/ChatMessage';
import type { PollResource } from '../../../../contexts/polls/infrastructure/http/resources/PollResource';
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
  onPollClose?: (poll: PollResource) => Promise<void>;
  onPollRemoveVote?: (poll: PollResource) => Promise<void>;
  onPollVote?: (poll: PollResource, optionIds: string[]) => Promise<void>;
  onStickerClick?: (sticker: StickerMessageReference) => void;
  onScroll: () => void;
  pinnedMessageIds: ReadonlySet<string>;
  reactionAuthorNames: Record<string, string>;
  polls?: PollResource[];
  scrollerRef: RefObject<HTMLDivElement | null>;
}
