import type { AttachmentProgress } from '../../../attachments/application/contracts/AttachmentProgress';
import type { AttachmentUploadOptions } from '../../../attachments/application/contracts/AttachmentUploadOptions';
import type { MessageAttachment } from '../../../attachments/application/contracts/MessageAttachment';
import type { Session } from '../../../identities/infrastructure/session/Session';

export interface MessageAttachmentPublisher {
  publishMessageAttachments(
    session: Session,
    attachments: File[],
    onProgress?: (progress: AttachmentProgress) => void,
    options?: AttachmentUploadOptions,
  ): Promise<MessageAttachment[]>;
  settleMessageAttachments(
    session: Session,
    attachments: MessageAttachment[],
  ): void;
  abandonMessageAttachments(
    session: Session,
    attachments: MessageAttachment[],
  ): Promise<void>;
}
