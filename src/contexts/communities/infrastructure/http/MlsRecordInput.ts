import type { MlsRecordKind } from './resources/MlsRecordKind';

/** What a client publishes; the id is derived from the content. */
export interface MlsRecordInput {
  epoch?: number;
  groupId: string;
  kind: MlsRecordKind;
  payload: string;
  recipientIdentityId?: string;
}
