import { DomainError } from '@haskou/value-objects';

export class InvalidPollQuestionError extends DomainError {
  public constructor() {
    super('Poll question must contain between 1 and 200 characters.');
  }
}
