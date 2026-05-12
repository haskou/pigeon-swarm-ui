export type EmojiSuggestion = {
  emoji: string;
  label: string;
  shortcode: string;
};

export type EmojiTrigger = {
  end: number;
  query: string;
  start: number;
};

const EMOJI_SUGGESTIONS: EmojiSuggestion[] = [
  { emoji: '😂', label: 'joy', shortcode: 'joy' },
  { emoji: '😭', label: 'sob', shortcode: 'sob' },
  { emoji: '🥲', label: 'smiling tear', shortcode: 'smiling_tear' },
  { emoji: '😊', label: 'smile', shortcode: 'smile' },
  { emoji: '🙂', label: 'slight smile', shortcode: 'slight_smile' },
  { emoji: '😍', label: 'heart eyes', shortcode: 'heart_eyes' },
  { emoji: '😘', label: 'kiss', shortcode: 'kissing_heart' },
  { emoji: '😎', label: 'sunglasses', shortcode: 'sunglasses' },
  { emoji: '🤔', label: 'thinking', shortcode: 'thinking' },
  { emoji: '😅', label: 'sweat smile', shortcode: 'sweat_smile' },
  { emoji: '😬', label: 'grimacing', shortcode: 'grimacing' },
  { emoji: '😡', label: 'rage', shortcode: 'rage' },
  { emoji: '😱', label: 'scream', shortcode: 'scream' },
  { emoji: '🤯', label: 'exploding head', shortcode: 'exploding_head' },
  { emoji: '🥳', label: 'party', shortcode: 'partying_face' },
  { emoji: '👍', label: 'thumbs up', shortcode: 'thumbsup' },
  { emoji: '👎', label: 'thumbs down', shortcode: 'thumbsdown' },
  { emoji: '🙏', label: 'pray', shortcode: 'pray' },
  { emoji: '👏', label: 'clap', shortcode: 'clap' },
  { emoji: '🙌', label: 'raised hands', shortcode: 'raised_hands' },
  { emoji: '🔥', label: 'fire', shortcode: 'fire' },
  { emoji: '✨', label: 'sparkles', shortcode: 'sparkles' },
  { emoji: '❤️', label: 'heart', shortcode: 'heart' },
  { emoji: '💔', label: 'broken heart', shortcode: 'broken_heart' },
  { emoji: '💀', label: 'skull', shortcode: 'skull' },
  { emoji: '🚀', label: 'rocket', shortcode: 'rocket' },
  { emoji: '✅', label: 'white check mark', shortcode: 'white_check_mark' },
  { emoji: '❌', label: 'x', shortcode: 'x' },
  { emoji: '⚠️', label: 'warning', shortcode: 'warning' },
  { emoji: '💡', label: 'bulb', shortcode: 'bulb' },
  { emoji: '🎉', label: 'tada', shortcode: 'tada' },
  { emoji: '🫡', label: 'saluting', shortcode: 'saluting_face' },
];

export function findEmojiTrigger(
  value: string,
  caretIndex: number,
): EmojiTrigger | null {
  const beforeCaret = value.slice(0, caretIndex);
  const match = /(^|\s):([a-zA-Z0-9_+\-]*)$/.exec(beforeCaret);

  if (!match) return null;

  const query = match[2].toLowerCase();
  const start = caretIndex - query.length - 1;

  return {
    end: caretIndex,
    query,
    start,
  };
}

export function searchEmojiSuggestions(
  query: string,
  limit = 6,
): EmojiSuggestion[] {
  const normalizedQuery = query.toLowerCase();

  if (!normalizedQuery) return EMOJI_SUGGESTIONS.slice(0, limit);

  const matches = EMOJI_SUGGESTIONS.filter(
    (suggestion) =>
      suggestion.shortcode.startsWith(normalizedQuery) ||
      suggestion.label.includes(normalizedQuery),
  );

  if (normalizedQuery.length === 1) return matches.slice(0, limit);

  return matches
    .sort((left, right) => {
      const leftStarts = left.shortcode.startsWith(normalizedQuery);
      const rightStarts = right.shortcode.startsWith(normalizedQuery);

      if (leftStarts === rightStarts) return left.shortcode.localeCompare(right.shortcode);

      return leftStarts ? -1 : 1;
    })
    .slice(0, limit);
}

export function replaceEmojiTrigger(
  value: string,
  trigger: EmojiTrigger,
  emoji: string,
): { nextCaretIndex: number; value: string } {
  const suffix = value.slice(trigger.end);
  const needsTrailingSpace = suffix.length === 0 || !/^\s/.test(suffix);
  const replacement = `${emoji}${needsTrailingSpace ? ' ' : ''}`;
  const nextValue =
    value.slice(0, trigger.start) + replacement + value.slice(trigger.end);

  return {
    nextCaretIndex: trigger.start + replacement.length,
    value: nextValue,
  };
}
