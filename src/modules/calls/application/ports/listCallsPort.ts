import type { CallResource } from '../../domain/callSession.types';
import type { ListCallsMessage } from '../list-calls/messages/listCallsMessage';

export interface ListCallsPort {
  list(message: ListCallsMessage): Promise<CallResource[]>;
}
