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

export function conversationTitle(conversation: {
  title?: string;
  peerIdentityId?: string;
  participantIdentityIds?: string[];
  id: string;
}): string {
  return (
    conversation.title ??
    conversation.peerIdentityId ??
    conversation.participantIdentityIds?.join(' ↔ ') ??
    conversation.id
  );
}
