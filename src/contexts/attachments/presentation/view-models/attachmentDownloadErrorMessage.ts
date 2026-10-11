import { PrivateBlobUnavailableError } from '../../infrastructure/http/PrivateBlobUnavailableError';

export interface AttachmentDownloadErrorCopy {
  errorMessage: string;
  unavailableMessage: string;
}

export function attachmentDownloadErrorMessage(
  error: unknown,
  copy: AttachmentDownloadErrorCopy,
): string {
  return error instanceof PrivateBlobUnavailableError
    ? copy.unavailableMessage
    : copy.errorMessage;
}
