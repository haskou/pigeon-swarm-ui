import type { ChatMessage } from '../../domain/types';

import { cx } from '../../utils/classNameHelper';
import { formatTime } from '../../utils/formatting';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  message: ChatMessage;
  currentIdentityId: string;
  authorName: string;
  authorPicture?: string | null;
  onAttachmentOpen: (attachmentIndex: number) => void;
  onAvatarClick: () => void;
  showAvatar: boolean;
}

export function MessageBubble({
  authorName,
  authorPicture,
  currentIdentityId,
  message,
  onAttachmentOpen,
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
          compactTimestamp &&
            message.attachments.length === 0 &&
            'flex items-end gap-2',
          mine
            ? 'bg-fuchsia-500 text-right text-white shadow-xl shadow-fuchsia-950/20'
            : 'border border-white/10 bg-black/25 text-white',
        )}
      >
        {message.content && (
          <p className={cx(message.encrypted && 'text-white/55')}>
            {message.content}
          </p>
        )}
        {message.attachments.length > 0 && (
          <div className={cx(message.content && 'mt-3', 'grid gap-2')}>
            {message.attachments.map((attachment, index) => (
              <button
                key={`${message.id}-${attachment.cid}`}
                type="button"
                onClick={() => onAttachmentOpen(index)}
                className={cx(
                  'flex max-w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition',
                  mine
                    ? 'border-white/20 bg-white/10 hover:bg-white/15'
                    : 'border-white/10 bg-white/8 hover:bg-white/12',
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/20 font-black">
                  ↓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">
                    {attachment.filename}
                  </span>
                  <span className="block text-xs opacity-65">
                    {formatFileSize(attachment.size)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        <div
          className={cx(
            'text-right text-xs font-black opacity-65',
            compactTimestamp && message.attachments.length === 0
              ? 'shrink-0'
              : 'mt-1',
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
