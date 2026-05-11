import type { ChatMessage } from '../../domain/types';

import { cx } from '../../utils/classNameHelper';
import { formatTime } from '../../utils/formatting';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: ChatMessage;
  currentIdentityId: string;
  authorName: string;
  authorPicture?: string | null;
  showAvatar: boolean;
}

export function MessageBubble({
  authorName,
  authorPicture,
  currentIdentityId,
  message,
  showAvatar,
}: MessageBubbleProps) {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;

  return (
    <div className={cx('flex gap-3', mine && 'justify-end')}>
      {!mine && (
        showAvatar ? (
          <Avatar label={authorName} picture={authorPicture} />
        ) : (
          <div className="w-11 shrink-0" />
        )
      )}
      <div
        className={cx(
          'max-w-[86%] rounded-3xl p-3 text-sm leading-relaxed sm:max-w-[72%]',
          mine
            ? 'bg-fuchsia-500 text-right text-white shadow-xl shadow-fuchsia-950/20'
            : 'border border-white/10 bg-black/25 text-white',
        )}
      >
        <p className={cx(message.encrypted && 'text-white/55')}>
          {message.content}
        </p>
        <div className="mt-1 text-right text-xs font-black opacity-65">
          {formatTime(message.timestamp)}
        </div>
      </div>
      {mine &&
        (showAvatar ? (
          <Avatar label={authorName} mine picture={authorPicture} />
        ) : (
          <div className="w-11 shrink-0" />
        ))}
    </div>
  );
}
