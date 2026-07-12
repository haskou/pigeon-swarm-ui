import type { CallResource } from '../../domain/callSession.types';
import type { ListCallsMessage } from './messages/ListCallsMessage';

export interface ListCallsPort {
  list(message: ListCallsMessage): Promise<CallResource[]>;
}
