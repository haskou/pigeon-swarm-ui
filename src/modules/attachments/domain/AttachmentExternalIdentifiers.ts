import type { MessageAttachment } from '../../../shared/domain/pigeonResources.types';

export class AttachmentExternalIdentifiers {
  public static from(attachments: MessageAttachment[]): string[] {
    return attachments.flatMap((attachment) => [
      attachment.cid,
      ...AttachmentExternalIdentifiers.fromPreview(attachment),
    ]);
  }

  private static fromPreview(attachment: MessageAttachment): string[] {
    return attachment.preview
      ? AttachmentExternalIdentifiers.from([attachment.preview])
      : [];
  }
}
