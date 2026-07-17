import { StringValueObject, assert } from '@haskou/value-objects';

import { MessageLinkPreviewUrlInvalidError } from '../errors/MessageLinkPreviewUrlInvalidError';

export class MessageLinkPreviewUrl extends StringValueObject {
  public static fromString(value: string): MessageLinkPreviewUrl {
    let parsed: URL;

    try {
      parsed = new URL(value);
    } catch {
      throw new MessageLinkPreviewUrlInvalidError();
    }

    assert(
      parsed.protocol === 'http:' || parsed.protocol === 'https:',
      new MessageLinkPreviewUrlInvalidError(),
    );

    return new MessageLinkPreviewUrl(parsed.toString());
  }

  private constructor(value: string) {
    super(value);
  }
}
