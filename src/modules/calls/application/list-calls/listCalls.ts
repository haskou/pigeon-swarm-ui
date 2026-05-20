import type { CallResource } from '../../domain/callSession.types';
import type { ListCallsPort } from '../ports/listCallsPort';

import { ListCallsMessage } from './messages/listCallsMessage';

export class ListCalls {
  public constructor(private readonly calls: ListCallsPort) {}

  public async list(message: ListCallsMessage): Promise<CallResource[]> {
    return await this.calls.list(message);
  }
}
