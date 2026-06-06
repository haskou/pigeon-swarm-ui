export type CommunityMentionTrigger = {
  end: number;
  query: string;
  start: number;
};

export function findMentionTrigger(
  value: string,
): CommunityMentionTrigger | null {
  const match = /(^|\s)@([^\s@]*)$/.exec(value);

  if (!match || match.index === undefined) return null;

  const prefixLength = match[1]?.length ?? 0;
  const start = match.index + prefixLength;

  return {
    end: value.length,
    query: match[2] ?? '',
    start,
  };
}
