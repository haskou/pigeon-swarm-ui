import { DomainError } from '@haskou/value-objects';

export class DirectConversationInvitationNotAllowedError extends DomainError {
  public constructor() {
    super('Participants cannot be invited to a direct conversation.');
  }
}
