export type BlobRequestInit = RequestInit & {
  onDownloadProgress?: (progress: {
    loadedBytes: number;
    totalBytes?: number;
  }) => void;
};
