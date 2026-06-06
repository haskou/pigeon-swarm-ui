import type { RealtimeDomainEvent } from './RealtimeDomainEvent';
import type { RealtimeTypingMessage } from './RealtimeTypingMessage';

export type RealtimeMessage =
  | {
      identityId: string;
      type: 'connection_ack';
    }
  | {
      identityId: string;
      timestamp: number;
      type: 'heartbeat_ack';
    }
  | {
      event: RealtimeDomainEvent;
      type: 'domain_event';
    }
  | RealtimeTypingMessage;
