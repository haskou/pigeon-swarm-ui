import type { MessageAttachment } from '../../application/contracts/MessageAttachment';

export class PendingMessageAttachments {
  public static fromFiles(
    files: File[],
    messageId: string,
  ): MessageAttachment[] {
    return files.map((file, index) => ({
      cid: `${messageId}:pending-attachment:${index}`,
      contentType: file.type || 'application/octet-stream',
      encrypted: true,
      encryptedSize: file.size,
      encryption: {
        algorithm: 'AES-GCM',
        chunks: [],
        chunkSize: 0,
        iv: '',
        key: '',
      },
      filename: file.name || `attachment-${index + 1}`,
      localFile: file,
      size: file.size,
      type: 'chunked_file',
    }));
  }
}
