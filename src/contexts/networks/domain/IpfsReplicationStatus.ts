import type { IpfsReplicationSummary } from './IpfsReplicationSummary';

export type IpfsReplicationStatus = {
  localNodeId: string;
  summary: IpfsReplicationSummary;
};
