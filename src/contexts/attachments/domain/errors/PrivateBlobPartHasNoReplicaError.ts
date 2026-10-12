import { DomainError } from '@haskou/value-objects';

export class PrivateBlobPartHasNoReplicaError extends DomainError {
  public constructor() {
    super('Private blob part has no stored replica');
  }
}
