import type { MlsRecordResource } from './MlsRecordResource';

export interface MlsRecordsResource {
  communityId: string;
  groupId: string;
  records: MlsRecordResource[];
}
