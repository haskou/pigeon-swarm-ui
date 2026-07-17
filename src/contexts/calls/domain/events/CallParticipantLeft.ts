import type { DomainEvent } from '../../../../shared/domain/DomainEvent';

export type CallParticipantLeft = DomainEvent & {
  type: 'CallParticipantLeft';
};
