export type AttachmentProgress = {
  filename: string;
  percent: number;
  phase: 'decrypt' | 'download' | 'encrypt' | 'upload';
};
