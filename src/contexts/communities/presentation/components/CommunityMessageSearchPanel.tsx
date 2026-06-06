import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

export type CommunityMessageSearchScope = 'channel' | 'community';

export type CommunityMessageSearchResultItem = {
  channelId: string;
  channelName: string;
  message: ChatMessage;
};

type CommunityMessageSearchPanelProps = {
  disabled?: boolean;
  error: null | string;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onResultClick: (result: CommunityMessageSearchResultItem) => void;
  onScopeChange: (scope: CommunityMessageSearchScope) => void;
  onSubmit: () => void;
  query: string;
  results: CommunityMessageSearchResultItem[];
  searched: boolean;
  scope: CommunityMessageSearchScope;
  state: 'idle' | 'loading';
};

export function CommunityMessageSearchPanel({
  disabled = false,
  error,
  onClose,
  onQueryChange,
  onResultClick,
  onScopeChange,
  onSubmit,
  query,
  results,
  searched,
  scope,
  state,
}: CommunityMessageSearchPanelProps) {
  const canSearch = query.trim().length > 0 && state !== 'loading' && !disabled;

  return (
    <section className="border-b border-white/10 bg-black/20 px-4 py-3">
      <form
        className="mx-auto flex max-w-5xl flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSearch) onSubmit();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            aria-label={copy.communities.searchMessages}
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/60"
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={copy.communities.searchMessagesPlaceholder}
            value={query}
          />
          <button
            className={cx(
              'rounded-2xl px-4 py-3 text-sm font-black transition',
              canSearch
                ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                : 'cursor-not-allowed bg-white/10 text-white/35',
            )}
            disabled={!canSearch}
            type="submit"
          >
            {state === 'loading'
              ? copy.communities.searchMessagesLoading
              : copy.communities.searchMessagesAction}
          </button>
          <button
            aria-label={copy.dialog.close}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-lg font-black text-white/70 transition hover:bg-white/15"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScopeButton
            active={scope === 'channel'}
            label={copy.communities.searchMessagesInChannel}
            onClick={() => onScopeChange('channel')}
          />
          <ScopeButton
            active={scope === 'community'}
            label={copy.communities.searchMessagesInCommunity}
            onClick={() => onScopeChange('community')}
          />
        </div>
        {error ? (
          <div className="rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        {results.length > 0 ? (
          <div className="grid gap-2">
            {results.map((result) => (
              <button
                className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:bg-white/10"
                key={`${result.channelId}:${result.message.id}`}
                onClick={() => onResultClick(result)}
                type="button"
              >
                <span className="block text-xs font-black uppercase tracking-[0.16em] text-cyan-200/70">
                  # {result.channelName}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm leading-6 text-white/80">
                  {result.message.content ||
                    copy.communities.searchMessagesResult}
                </span>
              </button>
            ))}
          </div>
        ) : searched && state === 'idle' && !error ? (
          <p className="text-sm text-white/45">
            {copy.communities.searchMessagesEmpty}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function ScopeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cx(
        'rounded-full px-3 py-1.5 text-xs font-black transition',
        active
          ? 'bg-cyan-300 text-slate-950'
          : 'bg-white/10 text-white/60 hover:bg-white/15',
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
