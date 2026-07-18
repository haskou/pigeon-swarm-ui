import { Timestamp } from '@haskou/value-objects';

import { MessageBody } from '../../../../contexts/messages/domain/entities/MessageBody';
import { MessageLifecycle } from '../../../../contexts/messages/domain/entities/MessageLifecycle';
import { MessageReactions } from '../../../../contexts/messages/domain/entities/MessageReactions';
import { MessageAuthorIdRequiredError } from '../../../../contexts/messages/domain/errors/MessageAuthorIdRequiredError';
import { MessageLinkPreviewUrlInvalidError } from '../../../../contexts/messages/domain/errors/MessageLinkPreviewUrlInvalidError';
import { MessagePageLimitInvalidError } from '../../../../contexts/messages/domain/errors/MessagePageLimitInvalidError';
import { MessageAuthorId } from '../../../../contexts/messages/domain/value-objects/MessageAuthorId';
import { MessageContent } from '../../../../contexts/messages/domain/value-objects/MessageContent';
import { MessageKind } from '../../../../contexts/messages/domain/value-objects/MessageKind';
import { MessageLinkPreviewUrl } from '../../../../contexts/messages/domain/value-objects/MessageLinkPreviewUrl';
import { MessagePageLimit } from '../../../../contexts/messages/domain/value-objects/MessagePageLimit';
import { MessageReactionEmoji } from '../../../../contexts/messages/domain/value-objects/MessageReactionEmoji';
import { MessageVisibility } from '../../../../contexts/messages/domain/value-objects/MessageVisibility';

describe('message domain values', () => {
  it('normalizes PEM identity identifiers and rejects empty authors', () => {
    expect(
      MessageAuthorId.fromString(
        '-----BEGIN PUBLIC KEY-----\nidentity-a\n-----END PUBLIC KEY-----',
      ).toString(),
    ).toBe('identity-a');
    expect(() => MessageAuthorId.fromString(' ')).toThrow(
      MessageAuthorIdRequiredError,
    );
  });

  it('requires a positive page limit', () => {
    expect(MessagePageLimit.fromNumber(30).valueOf()).toBe(30);
    expect(() => MessagePageLimit.fromNumber(0)).toThrow(
      MessagePageLimitInvalidError,
    );
  });

  it('finds and validates the first link preview URL', () => {
    const content = MessageContent.fromString(
      'Read www.example.com/docs, then ignore https://example.org.',
    );

    expect(content.findFirstLinkPreviewUrl()?.toString()).toBe(
      'https://www.example.com/docs',
    );
    expect(
      MessageContent.fromString('No links here').findFirstLinkPreviewUrl(),
    ).toBeUndefined();
    expect(() =>
      MessageLinkPreviewUrl.fromString('javascript:alert(1)'),
    ).toThrow(MessageLinkPreviewUrlInvalidError);
  });

  it('keeps body, lifecycle and reactions cohesive', () => {
    const body = MessageBody.create(
      MessageContent.fromString('Hello'),
      MessageKind.message(),
      MessageVisibility.readable(),
    );
    const lifecycle = MessageLifecycle.create(new Timestamp(100));
    const reactions = MessageReactions.empty();
    const author = MessageAuthorId.fromString('author-a');
    const emoji = MessageReactionEmoji.fromString('👍');

    lifecycle.deliver();

    expect(body.canBeEdited()).toBe(true);
    expect(lifecycle.canBeEdited()).toBe(true);
    expect(reactions.add(author, emoji, new Timestamp(200))).toBe(true);
    expect(reactions.add(author, emoji, new Timestamp(201))).toBe(false);
    expect(reactions.remove(author, emoji)).toBe(true);
    expect(
      MessageBody.fromPrimitives(body.toPrimitives()).toPrimitives(),
    ).toEqual(body.toPrimitives());
    expect(
      MessageLifecycle.fromPrimitives(lifecycle.toPrimitives()).toPrimitives(),
    ).toEqual(lifecycle.toPrimitives());
  });
});
