import type { RealtimeDomainEvent } from '../../../../shared/infrastructure/realtime/RealtimeGateway';

export type WorkspaceRealtimeEventsDialog = {
  events: RealtimeDomainEvent[];
  onClose: () => void;
  open: boolean;
};
