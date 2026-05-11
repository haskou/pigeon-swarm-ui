import type { ChatMessage } from '../../domain/types';

import { cx } from '../../utils/classNameHelper';
import { formatTime } from '../../utils/formatting';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: ChatMessage;
  currentIdentityId: string;
  authorName: string;
  authorPicture?: string | null;
  onAvatarClick: () => void;
  showAvatar: boolean;
}

export function MessageBubble({
  authorName,
  authorPicture,
  currentIdentityId,
  message,
  onAvatarClick,
  showAvatar,
}: MessageBubbleProps) {
  const mine = message.mine || message.authorIdentityId === currentIdentityId;
  const compactTimestamp =
    message.content.length <= 36 && !message.content.includes('\n');

  return (
    <div className={cx('flex gap-3', mine && 'justify-end')}>
      {!mine && (
        showAvatar ? (
          <Avatar
            label={authorName}
            onClick={onAvatarClick}
            picture={authorPicture}
          />
        ) : (
          <div className="w-11 shrink-0" />
        )
      )}
      <div
        className={cx(
          'max-w-[86%] rounded-3xl p-3 text-sm leading-relaxed sm:max-w-[72%]',
          compactTimestamp && 'flex items-end gap-2',
          mine
            ? 'bg-fuchsia-500 text-right text-white shadow-xl shadow-fuchsia-950/20'
            : 'border border-white/10 bg-black/25 text-white',
        )}
      >
        <p className={cx(message.encrypted && 'text-white/55')}>
          {message.content}
        </p>
        <div
          className={cx(
            'text-right text-xs font-black opacity-65',
            compactTimestamp ? 'shrink-0' : 'mt-1',
          )}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
      {mine &&
        (showAvatar ? (
          <Avatar
            label={authorName}
            mine
            onClick={onAvatarClick}
            picture={authorPicture}
          />
        ) : (
          <div className="w-11 shrink-0" />
        ))}
    </div>
  );
}
