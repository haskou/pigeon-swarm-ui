import { StringValueObject } from '@haskou/value-objects';

const encrypted = 'encrypted';
const readable = 'readable';

export class MessageVisibility extends StringValueObject {
  public static encrypted(): MessageVisibility {
    return new MessageVisibility(encrypted);
  }

  public static readable(): MessageVisibility {
    return new MessageVisibility(readable);
  }

  private constructor(value: typeof encrypted | typeof readable) {
    super(value);
  }

  public isReadable(): boolean {
    return this.isEqual(MessageVisibility.readable());
  }
}
