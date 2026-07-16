import type { MessageAttachment } from '../resources/MessageAttachment';

export type EncryptedAttachmentUpload = {
  chunks?: MessageAttachment['chunks'];
  cid: string;
  size: number;
  type?: MessageAttachment['type'];
};
