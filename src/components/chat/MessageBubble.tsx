import type { ChatMessage } from '../../domain/types';

import { cx } from '../../utils/classNameHelper';
import { formatTime, shortId } from '../../utils/formatting';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: ChatMessage;
  currentIdentityId: string;
}

export function MessageBubble({
  currentIdentityId,
  message,
}: MessageBubbleProps): JSX.Element {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;

  return (
    <div className={cx('flex gap-3', mine && 'justify-end')}>
      {!mine && <Avatar label={message.authorIdentityId} />}
      <div
        className={cx(
          'max-w-[86%] rounded-3xl p-3 text-sm leading-relaxed sm:max-w-[72%]',
          mine
            ? 'bg-fuchsia-500 text-white shadow-xl shadow-fuchsia-950/20'
            : 'border border-white/10 bg-black/25 text-white',
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-4 text-xs font-black opacity-75">
          <span>{mine ? 'You' : shortId(message.authorIdentityId)}</span>
          <span>{formatTime(message.timestamp)}</span>
        </div>
        <p className={cx(message.encrypted && 'text-white/55')}>
          {message.content}
        </p>
      </div>
      {mine && <Avatar label="You" mine />}
    </div>
  );
}
