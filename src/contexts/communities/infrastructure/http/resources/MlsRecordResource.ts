import type { MlsRecordKind } from './MlsRecordKind';

/** One opaque MLS record as the node stores and returns it. */
export interface MlsRecordResource {
  authorIdentityId: string;
  communityId: string;
  createdAt: number;
  epoch?: number;
  groupId: string;
  kind: MlsRecordKind;
  /** Base64 of the MLS message; the node never parses it. */
  payload: string;
  recipientIdentityId?: string;
  recordId: string;
}
