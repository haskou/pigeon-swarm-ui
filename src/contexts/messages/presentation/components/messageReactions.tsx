import type { ChatMessage } from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';

export type ReactionGroup = {
  authors: string[];
  count: number;
  emoji: string;
  lastCreatedAt: number;
  reacted: boolean;
};

export function MessageReactions({
  groups,
  mine,
  onToggle,
}: {
  groups: ReactionGroup[];
  mine?: boolean;
  onToggle: (emoji: string, reacted: boolean) => void;
}) {
  return (
    <div
      className={cx(
        'mt-1 flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {groups.map((group) => (
        <button
          type="button"
          key={group.emoji}
          onClick={() => onToggle(group.emoji, group.reacted)}
          className={cx(
            'inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-black leading-none shadow-sm backdrop-blur transition hover:brightness-110',
            group.reacted
              ? 'border-sky-200/45 bg-sky-400/35 text-sky-50 shadow-sky-950/20'
              : 'border-white/12 bg-black/25 text-white/78 shadow-black/15 hover:bg-white/10',
          )}
          aria-label={`${group.emoji} ${group.count}`}
          title={group.authors.join(', ')}
        >
          <span
            className="inline-grid min-h-6 min-w-6 place-items-center text-xl leading-none"
            style={{
              fontFamily:
                '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
            }}
          >
            {group.emoji}
          </span>
          <span className="tabular-nums leading-none">{group.count}</span>
        </button>
      ))}
    </div>
  );
}

export function groupMessageReactions(
  reactions: ChatMessage['reactions'],
  currentIdentityId: string,
  authorNames: Record<string, string>,
): ReactionGroup[] {
  const byEmoji = new Map<string, ReactionGroup>();

  for (const reaction of reactions ?? []) {
    const current = byEmoji.get(reaction.emoji) ?? {
      authors: [],
      count: 0,
      emoji: reaction.emoji,
      lastCreatedAt: reaction.createdAt,
      reacted: false,
    };

    current.authors.push(
      reactionTitleAuthorName(
        authorNames[reaction.authorIdentityId] ?? reaction.authorIdentityId,
      ),
    );
    current.count += 1;
    current.lastCreatedAt = Math.max(current.lastCreatedAt, reaction.createdAt);
    current.reacted =
      current.reacted || reaction.authorIdentityId === currentIdentityId;
    byEmoji.set(reaction.emoji, current);
  }

  return [...byEmoji.values()].sort((left, right) => {
    const createdAtDiff = left.lastCreatedAt - right.lastCreatedAt;

    return createdAtDiff === 0
      ? left.emoji.localeCompare(right.emoji)
      : createdAtDiff;
  });
}

function reactionTitleAuthorName(authorName: string): string {
  return authorName.replace(/\s+\(@[^)]+\)$/, '').trim() || authorName;
}
