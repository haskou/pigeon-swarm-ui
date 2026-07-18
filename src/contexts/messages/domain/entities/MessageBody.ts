import type { PrimitiveOf } from '@haskou/value-objects';

import { MessageContent } from '../value-objects/MessageContent';
import { MessageKind } from '../value-objects/MessageKind';
import { MessageVisibility } from '../value-objects/MessageVisibility';

export class MessageBody {
  public static create(
    content: MessageContent,
    kind: MessageKind,
    visibility: MessageVisibility,
  ): MessageBody {
    return new MessageBody(content, kind, visibility);
  }

  public static fromPrimitives(
    primitives: PrimitiveOf<MessageBody>,
  ): MessageBody {
    return new MessageBody(
      MessageContent.fromString(primitives.content),
      MessageKind.fromPrimitives(primitives.kind),
      primitives.encrypted
        ? MessageVisibility.encrypted()
        : MessageVisibility.readable(),
    );
  }

  private constructor(
    private content: MessageContent,
    private readonly kind: MessageKind,
    private readonly visibility: MessageVisibility,
  ) {}

  public canBeEdited(): boolean {
    return (
      this.visibility.isReadable() &&
      this.kind.isEditableText() &&
      !this.content.isBlank()
    );
  }

  public edit(content: MessageContent): boolean {
    if (this.content.isEqual(content)) return false;

    this.content = content;

    return true;
  }

  public toPrimitives() {
    return {
      content: this.content.toString(),
      encrypted: !this.visibility.isReadable(),
      kind: this.kind.valueOf(),
    };
  }
}
