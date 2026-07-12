import {
  findEmojiTrigger,
  preloadEmojiSuggestions,
  replaceEmojiTrigger,
  searchEmojiSuggestions,
} from '../../../../../contexts/messages/presentation/emoji/emojiShortcodes';

describe('emoji shortcode helpers', () => {
  it('finds a shortcode trigger before the caret', () => {
    expect(findEmojiTrigger('hello :so', 9)).toEqual({
      end: 9,
      query: 'so',
      start: 6,
    });
  });

  it('does not find a trigger in the middle of a word', () => {
    expect(findEmojiTrigger('hello:test', 10)).toBeNull();
  });

  it('returns sob for :s suggestions', async () => {
    expect(
      (await searchEmojiSuggestions('s')).map(
        (suggestion) => suggestion.shortcode,
      ),
    ).toContain('sob');
  });

  it('preloads the emoji catalog', async () => {
    await expect(preloadEmojiSuggestions()).resolves.toBeUndefined();
  });

  it('replaces the trigger and keeps the caret after the emoji', () => {
    expect(
      replaceEmojiTrigger(
        'hello :sob',
        { end: 10, query: 'sob', start: 6 },
        '😭',
      ),
    ).toEqual({
      nextCaretIndex: 9,
      value: 'hello 😭 ',
    });
  });
});
