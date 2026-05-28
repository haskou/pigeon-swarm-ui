import { cx } from '../../../../shared/presentation/cx';

type SkeletonMessage = {
  avatar: boolean;
  bubbleWidthRem: number;
  image?: boolean;
  lines: number[];
  mine: boolean;
  reply?: boolean;
};

const skeletonMessages: SkeletonMessage[] = [
  {
    avatar: true,
    bubbleWidthRem: 17,
    lines: [64, 88],
    mine: false,
  },
  {
    avatar: false,
    bubbleWidthRem: 20,
    image: true,
    lines: [82],
    mine: true,
  },
  {
    avatar: true,
    bubbleWidthRem: 19,
    lines: [94, 70, 42],
    mine: false,
    reply: true,
  },
  {
    avatar: false,
    bubbleWidthRem: 13,
    lines: [76],
    mine: true,
  },
  {
    avatar: true,
    bubbleWidthRem: 18,
    image: true,
    lines: [56],
    mine: false,
  },
];

export function MessageListSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-4" aria-hidden="true">
      <div className="mx-auto h-7 w-28 rounded-full border border-white/10 bg-white/5" />
      {skeletonMessages.map((message, index) => (
        <SkeletonMessageRow
          key={`${message.mine ? 'mine' : 'theirs'}-${index}`}
          message={message}
        />
      ))}
    </div>
  );
}

function SkeletonMessageRow({ message }: { message: SkeletonMessage }) {
  return (
    <div
      className={cx(
        'flex min-w-0 items-end gap-3',
        message.mine && 'justify-end',
      )}
    >
      {!message.mine && <SkeletonAvatar visible={message.avatar} />}
      <div
        className={cx(
          'flex min-w-0 max-w-[96%] flex-col sm:max-w-[72%]',
          message.mine ? 'items-end' : 'items-start',
        )}
      >
        {!message.mine && message.avatar && (
          <div className="mb-1 h-3 w-24 rounded-full bg-white/8" />
        )}
        <div
          className={cx(
            'min-w-0 rounded-2xl border p-3',
            message.mine
              ? 'border-white/15 bg-[#274279]/70'
              : 'border-white/10 bg-black/25',
          )}
          style={{
            width: `min(${message.bubbleWidthRem}rem, ${
              message.mine ? '74vw' : '76vw'
            })`,
          }}
        >
          {message.reply && <SkeletonReply />}
          {message.image && <SkeletonImageAttachment mine={message.mine} />}
          <div className="space-y-2">
            {message.lines.map((width, index) => (
              <div
                key={`${width}-${index}`}
                className="h-3 rounded-full bg-white/12"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <div className="h-2.5 w-10 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonAvatar({ visible }: { visible: boolean }) {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-start">
      {visible ? (
        <div className="h-10 w-10 rounded-2xl bg-white/10" />
      ) : (
        <div className="w-11 shrink-0" />
      )}
    </div>
  );
}

function SkeletonReply() {
  return (
    <div className="mb-3 rounded-xl border-l-2 border-white/25 bg-white/7 p-2">
      <div className="h-2.5 w-20 rounded-full bg-white/14" />
      <div className="mt-2 h-2.5 w-36 rounded-full bg-white/10" />
    </div>
  );
}

function SkeletonImageAttachment({ mine }: { mine: boolean }) {
  return (
    <div
      className={cx(
        'mb-3 aspect-[4/3] w-full overflow-hidden rounded-xl border',
        mine ? 'border-white/16 bg-white/10' : 'border-white/10 bg-white/7',
      )}
    >
      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/6 to-transparent" />
        <div className="absolute left-4 top-4 h-8 w-8 rounded-full bg-white/12" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white/12 to-transparent" />
        <div className="absolute bottom-4 left-4 right-12 h-3 rounded-full bg-white/12" />
        <div className="absolute bottom-8 left-4 h-3 w-1/2 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
