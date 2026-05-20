export function shortId(value: string): string {
  if (value.length <= 18) return value;

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function formatTime(timestamp: number | string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function formatDateSeparator(timestamp: number | string): string {
  const date = new Date(timestamp);
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const yesterday = new Date(today);

  yesterday.setDate(today.getDate() - 1);

  if (target.getTime() === today.getTime()) return 'Today';

  if (target.getTime() === yesterday.getTime()) return 'Yesterday';

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: today.getFullYear() === target.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export function isSameDay(
  leftTimestamp: number | string,
  rightTimestamp: number | string,
): boolean {
  return (
    startOfDay(new Date(leftTimestamp)).getTime() ===
    startOfDay(new Date(rightTimestamp)).getTime()
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function conversationTitle(conversation: {
  name?: string;
  title?: string;
  peerIdentityId?: string;
  participantIdentityIds?: string[];
  id: string;
}): string {
  return (
    conversation.name ??
    conversation.title ??
    conversation.peerIdentityId ??
    conversation.participantIdentityIds?.join(' ↔ ') ??
    conversation.id
  );
}
