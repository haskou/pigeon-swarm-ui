import { EmojiOnlyMessage } from './EmojiOnlyMessage';

describe(EmojiOnlyMessage.name, () => {
  it('returns the largest class for one emoji', () => {
    expect(EmojiOnlyMessage.sizeClass('💯')).toBe('text-5xl leading-none');
  });

  it('returns a large class for two emojis', () => {
    expect(EmojiOnlyMessage.sizeClass('💯 🔥')).toBe('text-4xl leading-none');
  });

  it('returns a compact large class for three emojis', () => {
    expect(EmojiOnlyMessage.sizeClass('💯🔥✨')).toBe('text-3xl leading-tight');
  });

  it('does not enlarge mixed text and emoji messages', () => {
    expect(EmojiOnlyMessage.sizeClass('joder 💯')).toBeNull();
  });

  it('does not enlarge long emoji runs', () => {
    expect(EmojiOnlyMessage.sizeClass('💯🔥✨🚀')).toBeNull();
  });
});
