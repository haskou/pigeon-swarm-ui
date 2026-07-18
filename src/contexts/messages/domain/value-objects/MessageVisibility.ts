import { Enum } from '@haskou/value-objects';

const values = ['encrypted', 'readable'] as const;

export class MessageVisibility extends Enum<(typeof values)[number]> {
  public static encrypted(): MessageVisibility {
    return new MessageVisibility('encrypted');
  }

  public static readable(): MessageVisibility {
    return new MessageVisibility('readable');
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isReadable(): boolean {
    return this.isEqual(MessageVisibility.readable());
  }
}
