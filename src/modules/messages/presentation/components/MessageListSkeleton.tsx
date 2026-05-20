import { cx } from '../../../../shared/presentation/cx';

export function MessageListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className={cx(
            'flex animate-pulse items-end gap-2',
            item % 2 === 0 ? 'justify-start' : 'justify-end',
          )}
        >
          {item % 2 === 0 && (
            <div className="h-9 w-9 rounded-2xl bg-white/10" />
          )}
          <div
            className={cx(
              'rounded-3xl bg-white/10',
              item % 2 === 0 ? 'h-16 w-56' : 'h-12 w-44',
            )}
          />
          {item % 2 !== 0 && (
            <div className="h-9 w-9 rounded-2xl bg-white/10" />
          )}
        </div>
      ))}
    </div>
  );
}
