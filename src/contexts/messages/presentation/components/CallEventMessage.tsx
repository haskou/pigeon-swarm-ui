import type {
  ChatMessage,
  MessageResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { formatTime } from '../../../../shared/presentation/formatting';

export function CallEventMessage({
  currentIdentityId,
  message,
}: {
  currentIdentityId: string;
  message: ChatMessage;
}) {
  const direction = callEventDirection(message, currentIdentityId);
  const label = callEventLabel(message.raw.callEventType);
  const duration = formatDuration(message.raw.durationMs);

  return (
    <div
      data-message-id={message.id}
      className="flex w-full items-center gap-3 py-2"
    >
      <span className="h-px flex-1 bg-white/[0.07]" />
      <div className="text-xs font-bold text-white/45">
        {direction && (
          <>
            <span>{direction}</span>
            <span className="text-white/30"> · </span>
          </>
        )}
        <span>{label}</span>
        {duration && <span className="text-white/35"> · {duration}</span>}
        <span className="text-white/30">
          {' '}
          · {formatTime(message.timestamp)}
        </span>
      </div>
      <span className="h-px flex-1 bg-white/[0.07]" />
    </div>
  );
}

function callEventDirection(
  message: ChatMessage,
  currentIdentityId: string,
): string | null {
  const actorIdentityId =
    message.raw.actorIdentityId ??
    (message.authorIdentityId !== 'unknown' &&
    message.authorIdentityId !== 'system'
      ? message.authorIdentityId
      : undefined);

  if (!actorIdentityId) return null;

  return actorIdentityId === currentIdentityId
    ? copy.calls.incomingCallDirection
    : copy.calls.outgoingCallDirection;
}

function callEventLabel(eventType: MessageResource['callEventType']): string {
  if (eventType === 'missed') return copy.calls.missed;

  if (eventType === 'declined') return copy.calls.declined;

  return copy.calls.ended;
}

function formatDuration(durationMs?: number): string | null {
  if (!durationMs || durationMs <= 0) return null;

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
