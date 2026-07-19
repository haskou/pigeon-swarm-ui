import { MessageContent } from '../../../../../contexts/messages/domain/value-objects/MessageContent';

describe(MessageContent.name, () => {
  it('recognizes content containing only whitespace as blank', () => {
    expect(MessageContent.fromString('  \n ').isBlank()).toBe(true);
    expect(MessageContent.fromString('hello').isBlank()).toBe(false);
  });

  it('finds and normalizes the first link preview URL', () => {
    const url = MessageContent.fromString(
      'Read www.example.com/docs, then continue.',
    ).findFirstLinkPreviewUrl();

    expect(url?.toString()).toBe('https://www.example.com/docs');
  });

  it('returns no preview URL when the content has no link', () => {
    expect(
      MessageContent.fromString('Nothing to preview').findFirstLinkPreviewUrl(),
    ).toBeUndefined();
  });
});
