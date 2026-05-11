import type { ChatMessage } from '../../domain/types';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';
import { formatTime } from '../../utils/formatting';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: ChatMessage;
  currentIdentityId: string;
  authorName: string;
}

export function MessageBubble({
  authorName,
  currentIdentityId,
  message,
}: MessageBubbleProps) {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;

  return (
    <div className={cx('flex gap-3', mine && 'justify-end')}>
      {!mine && <Avatar label={authorName} />}
      <div
        className={cx(
          'max-w-[86%] rounded-3xl p-3 text-sm leading-relaxed sm:max-w-[72%]',
          mine
            ? 'bg-fuchsia-500 text-right text-white shadow-xl shadow-fuchsia-950/20'
            : 'border border-white/10 bg-black/25 text-white',
        )}
      >
        <div
          className={cx(
            'mb-1 flex items-center gap-4 text-xs font-black opacity-75',
            mine ? 'justify-end' : 'justify-between',
          )}
        >
          <span>{mine ? copy.chat.you : authorName}</span>
          <span>{formatTime(message.timestamp)}</span>
        </div>
        <p className={cx(message.encrypted && 'text-white/55')}>
          {message.content}
        </p>
      </div>
      {mine && <Avatar label={authorName || copy.chat.you} mine />}
    </div>
  );
}
