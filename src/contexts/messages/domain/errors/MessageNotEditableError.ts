import { DomainError } from '@haskou/value-objects';

export class MessageNotEditableError extends DomainError {
  public constructor() {
    super('This message cannot be edited by this identity.');
  }
}
