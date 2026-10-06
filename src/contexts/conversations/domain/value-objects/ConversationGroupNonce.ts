import { StringValueObject, assert } from '@haskou/value-objects';
import { Buffer } from 'buffer';

import { ConversationGroupNonceRequiredError } from '../errors/ConversationGroupNonceRequiredError';

/** Client-chosen randomness a group id commits to, so ids cannot be claimed. */
export class ConversationGroupNonce extends StringValueObject {
  private static readonly BYTES = 16;

  public static fromString(value: string): ConversationGroupNonce {
    return new ConversationGroupNonce(value.trim());
  }

  public static generate(): ConversationGroupNonce {
    const bytes = new Uint8Array(ConversationGroupNonce.BYTES);

    crypto.getRandomValues(bytes);

    return new ConversationGroupNonce(
      Buffer.from(bytes)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''),
    );
  }

  private constructor(value: string) {
    super(value);
    assert(!this.isEmpty(), new ConversationGroupNonceRequiredError());
  }
}
