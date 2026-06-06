import { memo, useEffect, useMemo, useRef, useState } from 'react';

import type { EmojiSuggestion } from '../../../messages/presentation/emoji/emojiShortcodes';

const EMOJI_GRID_COLUMNS = 7;
const EMOJI_ROW_HEIGHT_PX = 52;
const EMOJI_OVERSCAN_ROWS = 3;
const EMOJI_PANEL_INITIAL_VIEWPORT_PX = 320;

export const StickerEmojiPanel = memo(function StickerEmojiPanel({
  emojiQuery,
  emojis,
  loading,
  onEmojiInsert,
  onQueryChange,
}: {
  emojiQuery: string;
  emojis: EmojiSuggestion[];
  loading: boolean;
  onEmojiInsert: (emoji: string) => void;
  onQueryChange: (query: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    EMOJI_PANEL_INITIAL_VIEWPORT_PX,
  );
  const totalRows = Math.ceil(emojis.length / EMOJI_GRID_COLUMNS);
  const visibleRange = useMemo(() => {
    const startRow = Math.max(
      0,
      Math.floor(scrollTop / EMOJI_ROW_HEIGHT_PX) - EMOJI_OVERSCAN_ROWS,
    );
    const endRow = Math.min(
      totalRows,
      Math.ceil((scrollTop + viewportHeight) / EMOJI_ROW_HEIGHT_PX) +
        EMOJI_OVERSCAN_ROWS,
    );

    return {
      endIndex: endRow * EMOJI_GRID_COLUMNS,
      startIndex: startRow * EMOJI_GRID_COLUMNS,
      startRow,
    };
  }, [scrollTop, totalRows, viewportHeight]);
  const visibleEmojis = useMemo(
    () => emojis.slice(visibleRange.startIndex, visibleRange.endIndex),
    [emojis, visibleRange.endIndex, visibleRange.startIndex],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller) return undefined;

    const updateViewportHeight = () => {
      setViewportHeight(scroller.clientHeight || EMOJI_PANEL_INITIAL_VIEWPORT_PX);
    };

    updateViewportHeight();

    if (!('ResizeObserver' in window)) return undefined;

    const observer = new ResizeObserver(updateViewportHeight);

    observer.observe(scroller);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [emojiQuery, emojis.length]);

  return (
    <div className="flex h-[24rem] max-h-[calc(100dvh-8rem)] flex-col p-3">
      <input
        value={emojiQuery}
        onChange={(event) => onQueryChange(event.target.value)}
        className="mb-3 w-full shrink-0 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none placeholder:text-white/35"
        placeholder="Search emojis"
      />
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {loading ? (
          <EmojiLoadingGrid />
        ) : (
          <div
            className="relative"
            style={{ height: totalRows * EMOJI_ROW_HEIGHT_PX }}
          >
            <div
              className="grid grid-cols-[repeat(7,3rem)] justify-center gap-1"
              style={{
                transform: `translateY(${
                  visibleRange.startRow * EMOJI_ROW_HEIGHT_PX
                }px)`,
              }}
            >
              {visibleEmojis.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.shortcode}
                  onClick={() => onEmojiInsert(suggestion.emoji)}
                  className="grid h-12 w-12 place-items-center rounded-xl text-2xl leading-none transition hover:bg-white/10"
                  title={suggestion.shortcode}
                >
                  {suggestion.emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function EmojiLoadingGrid() {
  return (
    <div className="grid grid-cols-[repeat(7,3rem)] justify-center gap-1">
      {Array.from({ length: 35 }, (_, index) => (
        <div
          key={index}
          className="h-12 w-12 animate-pulse rounded-xl bg-white/8"
        />
      ))}
    </div>
  );
}
