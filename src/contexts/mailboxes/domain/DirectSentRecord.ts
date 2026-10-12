import type { DirectRecordBase } from './DirectRecordBase';

/** A message sent to the peer: text, a reply, attachments, or a sticker. */
export type DirectSentRecord = DirectRecordBase & {
  encryptedPayload: string;
  previousMessageIds: string[];
  replyToMessageId?: string;
  type: 'sent';
};
