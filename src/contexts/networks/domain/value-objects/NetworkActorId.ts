import { StringValueObject } from '@haskou/value-objects';

const anonymousActor = 'anonymous';

export class NetworkActorId extends StringValueObject {
  public static anonymous(): NetworkActorId {
    return new NetworkActorId(anonymousActor);
  }

  public static fromOptional(value?: string): NetworkActorId {
    const normalized = value?.trim();

    return normalized ? new NetworkActorId(normalized) : this.anonymous();
  }

  private constructor(value: string) {
    super(value);
  }

  public isAnonymous(): boolean {
    return this.isEqual(NetworkActorId.anonymous());
  }
}
