export interface IpfsReplicationStatus {
  localNodeId: string;
  summary: {
    contentCount: number;
    localResponsibleCount: number;
    totalSizeBytes: number;
    updatedAt: number;
  };
}
