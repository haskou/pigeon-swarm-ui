import type { MlsRecordInput } from '../http/MlsRecordInput';
import type { MlsRecordKind } from '../http/resources/MlsRecordKind';
import type { MlsRecordResource } from '../http/resources/MlsRecordResource';

/** Reads and writes the opaque records of one community. */
export interface MlsRecordTransport {
  list(query: {
    afterEpoch?: number;
    groupId: string;
    kind?: MlsRecordKind;
  }): Promise<MlsRecordResource[]>;
  publish(input: MlsRecordInput): Promise<MlsRecordResource>;
}
