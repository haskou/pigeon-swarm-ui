import type { CallResource } from '../../domain/callSession.types';
import type { ListCallsMessage } from '../list-calls/messages/ListCallsMessage';

export interface ListCallsPort {
  list(message: ListCallsMessage): Promise<CallResource[]>;
}
