import type { DomainEvent } from '../../../../shared/domain/DomainEvent';

export type CallParticipantMissed = DomainEvent & {
  type: 'CallParticipantMissed';
};
