import type { EmojiSuggestion } from '../emoji/emojiShortcodes';

export function StickerEmojiPanel({
  emojiQuery,
  emojis,
  onEmojiInsert,
  onQueryChange,
}: {
  emojiQuery: string;
  emojis: EmojiSuggestion[];
  onEmojiInsert: (emoji: string) => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="max-h-[24rem] overflow-y-auto p-3">
      <input
        value={emojiQuery}
        onChange={(event) => onQueryChange(event.target.value)}
        className="mb-3 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none placeholder:text-white/35"
        placeholder="Search emojis"
      />
      <div className="grid grid-cols-7 gap-1">
        {emojis.map((suggestion) => (
          <button
            type="button"
            key={suggestion.shortcode}
            onClick={() => onEmojiInsert(suggestion.emoji)}
            className="grid aspect-square place-items-center rounded-xl text-2xl transition hover:bg-white/10"
            title={suggestion.shortcode}
          >
            {suggestion.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
