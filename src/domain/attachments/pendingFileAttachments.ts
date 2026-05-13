import type { MessageAttachment } from '../types';

export function pendingFileAttachments(
  files: File[],
  messageId: string,
): MessageAttachment[] {
  return files.map((file, index) => ({
    cid: `${messageId}:pending-attachment:${index}`,
    contentType: file.type || 'application/octet-stream',
    encryptedSize: file.size,
    encryption: {
      algorithm: 'AES-GCM',
      chunkSize: 0,
      chunks: [],
      iv: '',
      key: '',
    },
    filename: file.name || `attachment-${index + 1}`,
    size: file.size,
    type: 'chunked_file',
  }));
}
