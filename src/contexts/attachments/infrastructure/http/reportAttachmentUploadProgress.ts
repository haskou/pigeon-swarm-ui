import type { AttachmentProgress } from '../../application/contracts/AttachmentProgress';

export function reportAttachmentUploadProgress(
  reporter: ((progress: AttachmentProgress) => void) | undefined,
  filename: string,
  percent: number,
): void {
  reporter?.({
    filename,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    phase: 'upload',
  });
}
