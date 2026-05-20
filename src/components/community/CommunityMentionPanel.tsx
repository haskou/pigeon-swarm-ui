import type { CommunityMessageMention } from '../../domain/types';

import { copy } from '../../i18n/en';

export type CommunityMentionSuggestion = {
  description: string;
  id: string;
  label: string;
  mention: CommunityMessageMention;
  token: string;
};

export function CommunityMentionPanel({
  onSelect,
  suggestions,
}: {
  onSelect: (token: string) => void;
  suggestions: CommunityMentionSuggestion[];
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-[#24242b] p-2 shadow-2xl shadow-black/40">
      <div className="mb-1 px-2 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
        {copy.composer.mentions}
      </div>
      {suggestions.map((suggestion) => (
        <button
          key={`${suggestion.mention.type}:${suggestion.id}`}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(suggestion.token);
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-400/20 text-sm font-black text-indigo-100">
            @
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-white">
              {suggestion.label}
            </span>
            <span className="block truncate text-xs text-white/45">
              {suggestion.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
