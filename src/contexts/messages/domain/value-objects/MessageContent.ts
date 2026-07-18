import { StringValueObject } from '@haskou/value-objects';

import { MessageLinkPreviewUrlInvalidError } from '../errors/MessageLinkPreviewUrlInvalidError';
import { MessageLinkPreviewUrl } from './MessageLinkPreviewUrl';

const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/i;

export class MessageContent extends StringValueObject {
  public static fromString(value: string): MessageContent {
    return new MessageContent(value);
  }

  private constructor(value: string) {
    super(value);
  }

  public findFirstLinkPreviewUrl(): MessageLinkPreviewUrl | undefined {
    const match = this.toString().match(urlPattern)?.[0];

    if (!match) return undefined;

    const cleaned = match.replace(/[),.;:!?]+$/g, '');
    const normalized = /^https?:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;

    try {
      return MessageLinkPreviewUrl.fromString(normalized);
    } catch (error) {
      if (error instanceof MessageLinkPreviewUrlInvalidError) return undefined;

      throw error;
    }
  }

  public isBlank(): boolean {
    return this.toString().trim().length === 0;
  }
}
