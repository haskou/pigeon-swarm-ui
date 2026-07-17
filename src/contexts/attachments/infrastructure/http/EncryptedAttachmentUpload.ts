import type { MessageAttachment } from '../../application/contracts/MessageAttachment';

export type EncryptedAttachmentUpload = {
  chunks?: MessageAttachment['chunks'];
  cid: string;
  size: number;
  type?: MessageAttachment['type'];
};
