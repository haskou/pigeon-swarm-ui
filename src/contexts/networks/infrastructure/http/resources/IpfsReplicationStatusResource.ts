export interface IpfsReplicationStatusResource {
  localNodeId: string;
  summary: {
    contentCount: number;
    localResponsibleCount: number;
    releasableCount: number;
    totalSizeBytes: number;
    updatedAt: number;
  };
}
