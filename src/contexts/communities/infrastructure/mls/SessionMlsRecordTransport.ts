import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { MlsRecordInput } from '../http/MlsRecordInput';
import type { PigeonMlsRecordsApi } from '../http/PigeonMlsRecordsApi';
import type { MlsRecordKind } from '../http/resources/MlsRecordKind';
import type { MlsRecordResource } from '../http/resources/MlsRecordResource';
import type { MlsRecordTransport } from './MlsRecordTransport';

/** Binds the node API to the session that is current at call time. */
export class SessionMlsRecordTransport implements MlsRecordTransport {
  public constructor(
    private readonly api: PigeonMlsRecordsApi,
    private readonly session: () => Session,
    private readonly communityId: string,
  ) {}

  public async list(query: {
    afterEpoch?: number;
    groupId: string;
    kind?: MlsRecordKind;
  }): Promise<MlsRecordResource[]> {
    return await this.api.list(this.session(), this.communityId, query);
  }

  public async publish(input: MlsRecordInput): Promise<MlsRecordResource> {
    return await this.api.publish(this.session(), this.communityId, input);
  }
}
