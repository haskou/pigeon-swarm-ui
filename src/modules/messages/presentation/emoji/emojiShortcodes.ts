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

let emojiSuggestionsPromise: Promise<EmojiSuggestion[]> | null = null;

export function findEmojiTrigger(
  value: string,
  caretIndex: number,
): EmojiTrigger | null {
  const beforeCaret = value.slice(0, caretIndex);
  const match = /(^|\s):([a-zA-Z][a-zA-Z0-9_+-]*)$/.exec(beforeCaret);

  if (!match) return null;

  const query = match[2].toLowerCase();
  const start = caretIndex - query.length - 1;

  return {
    end: caretIndex,
    query,
    start,
  };
}

export async function searchEmojiSuggestions(
  query: string,
  limit = 50,
): Promise<EmojiSuggestion[]> {
  const emojiSuggestions = await loadEmojiSuggestions();
  const normalizedQuery = query.toLowerCase();

  if (!normalizedQuery) return emojiSuggestions.slice(0, limit);

  const matches = emojiSuggestions.filter(
    (suggestion) =>
      suggestion.shortcode.startsWith(normalizedQuery) ||
      suggestion.label.includes(normalizedQuery),
  );

  return matches
    .sort((left, right) => {
      const leftStarts = left.shortcode.startsWith(normalizedQuery);
      const rightStarts = right.shortcode.startsWith(normalizedQuery);

      if (leftStarts !== rightStarts) {
        return leftStarts ? -1 : 1;
      }

      const lengthDifference = left.shortcode.length - right.shortcode.length;

      if (lengthDifference !== 0) return lengthDifference;

      return left.shortcode.localeCompare(right.shortcode);
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

function loadEmojiSuggestions(): Promise<EmojiSuggestion[]> {
  emojiSuggestionsPromise ??= import('./discordEmojiShortcodesGenerated').then(
    ({ DISCORD_EMOJI_SHORTCODES }) =>
      DISCORD_EMOJI_SHORTCODES.map(({ emoji, shortcode }) => ({
        emoji,
        label: shortcode.replace(/[_-]/g, ' '),
        shortcode,
      })),
  );

  return emojiSuggestionsPromise;
}
