export type IpfsReplicationSummary = {
  contentCount: number;
  localResponsibleCount: number;
  releasableCount: number;
  totalSizeBytes: number;
  updatedAt: number;
};

export type IpfsReplicationStatus = {
  localNodeId: string;
  summary: IpfsReplicationSummary;
};
