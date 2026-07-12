import type {
  IpfsReplicationStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface GetReplicationStatusPort {
  getIpfsReplicationStatus(session: Session): Promise<IpfsReplicationStatus>;
}
