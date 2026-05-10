import { cx } from '../../utils/classNameHelper';

interface SectionTitleProps {
  title: string;
  className?: string;
}

export function SectionTitle({ className, title }: SectionTitleProps) {
  return (
    <div
      className={cx(
        'mb-2 px-2 text-xs font-black uppercase tracking-[.22em] text-white/40',
        className,
      )}
    >
      {title}
    </div>
  );
}
