import type { CallResource } from '../../domain/callSession.types';
import type { ListCallsPort } from './ListCallsPort';

import { ListCallsMessage } from './messages/ListCallsMessage';

export class ListCalls {
  public constructor(private readonly calls: ListCallsPort) {}

  public async list(message: ListCallsMessage): Promise<CallResource[]> {
    return await this.calls.list(message);
  }
}
