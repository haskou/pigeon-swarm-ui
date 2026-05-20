import { cx } from '../../../../shared/presentation/cx';

export function ComposerMentionOverlay({
  mentionTokens,
  scrollTop,
  value,
}: {
  mentionTokens: string[];
  scrollTop: number;
  value: string;
}) {
  if (mentionTokens.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden px-2 py-0 text-sm leading-5 tracking-normal text-white [font:inherit]"
    >
      <div
        className="whitespace-pre-wrap break-words"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {highlightMentionTokens(value, mentionTokens)}
      </div>
    </div>
  );
}

function highlightMentionTokens(value: string, mentionTokens: string[]) {
  const pattern = mentionPattern(mentionTokens);

  if (!pattern) return value;

  const parts: Array<{ highlighted: boolean; text: string }> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    if (match.index > cursor) {
      parts.push({
        highlighted: false,
        text: value.slice(cursor, match.index),
      });
    }

    parts.push({ highlighted: true, text: match[0] });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    parts.push({ highlighted: false, text: value.slice(cursor) });
  }

  return parts.map((part, index) =>
    part.highlighted ? (
      <span
        key={index}
        className="rounded-md bg-fuchsia-400/20 font-black text-fuchsia-100"
      >
        {part.text}
      </span>
    ) : (
      <span key={index} className={cx(part.text === '' && 'hidden')}>
        {part.text}
      </span>
    ),
  );
}

function mentionPattern(mentionTokens: string[]): RegExp | null {
  const tokens = Array.from(new Set(mentionTokens.filter(Boolean))).sort(
    (left, right) => right.length - left.length,
  );

  if (tokens.length === 0) return null;

  return new RegExp(tokens.map(escapeRegExp).join('|'), 'gi');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
