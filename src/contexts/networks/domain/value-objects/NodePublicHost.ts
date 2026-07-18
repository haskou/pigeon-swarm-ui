import { StringValueObject } from '@haskou/value-objects';

export class NodePublicHost extends StringValueObject {
  public static fromOptional(value?: string): NodePublicHost {
    const normalized = value?.trim();

    return new NodePublicHost(normalized ?? '');
  }

  private constructor(value: string) {
    super(value);
  }

  public isConfigured(): boolean {
    return !this.isEmpty();
  }
}
