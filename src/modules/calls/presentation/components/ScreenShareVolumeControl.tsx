import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { ScreenSoundIcon } from './callIcons';
import { CallVolumeControl } from './CallVolumeControl';

export function ScreenShareVolumeControl({
  className,
  onChange,
  placement = 'overlay',
  value,
}: {
  className?: string;
  onChange: (volumePercent: number) => void;
  placement?: 'inline' | 'overlay';
  value: number;
}) {
  const overlay = placement === 'overlay';

  return (
    <CallVolumeControl
      className={cx(
        overlay
          ? 'absolute bottom-3 right-3 z-30 w-[min(18rem,calc(100%-1.5rem))] rounded-2xl border border-emerald-200/20 bg-black/70 p-3 text-white/70 shadow-xl shadow-black/40 backdrop-blur-md'
          : 'mt-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-2',
        className,
      )}
      icon={<ScreenSoundIcon active={value > 0} />}
      iconClassName={overlay ? 'text-emerald-200' : undefined}
      label={copy.calls.screenShareVolume}
      onChange={onChange}
      stopPropagation={overlay}
      value={value}
      valueClassName={overlay ? 'text-white' : undefined}
    />
  );
}
