import { DomainError } from '@haskou/value-objects';

export class CommunityChannelRestrictionRefusedError extends DomainError {
  public constructor() {
    super(
      'Only the owner, or a member who can add members and keeps seeing the channel, can restrict it to these roles.',
    );
  }
}
