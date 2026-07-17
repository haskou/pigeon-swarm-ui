import type { CallSession } from '../view-models/CallSession';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

export function MicrophoneBlockedNotice({
  call,
  compact = false,
  onRetryMicrophone,
}: {
  call: CallSession;
  compact?: boolean;
  onRetryMicrophone: () => void;
}) {
  return (
    <div
      className={cx(
        'border-l-2 border-amber-300/45 bg-amber-300/[0.08] text-left',
        compact ? 'px-3 py-2' : 'w-full px-4 py-3',
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={cx('font-black text-amber-50', compact && 'text-xs')}>
        {copy.calls.microphoneBlockedTitle}
      </div>
      <div
        className={cx(
          'mt-1 leading-snug text-amber-100/75',
          compact ? 'text-[0.7rem]' : 'text-sm',
        )}
      >
        {microphoneErrorText(call.microphoneError)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetryMicrophone}
          className={cx(
            microphoneNoticeActionClass(compact),
            'border-amber-100/60 bg-amber-100 text-amber-950 hover:bg-white',
          )}
        >
          {copy.calls.microphoneAllow}
        </button>
        <button
          type="button"
          onClick={onRetryMicrophone}
          className={cx(
            microphoneNoticeActionClass(compact),
            'border-white/10 bg-white/10 text-white/75 hover:bg-white/15 hover:text-white',
          )}
        >
          {copy.calls.microphoneRetry}
        </button>
        <a
          href="https://support.google.com/chrome/answer/2693767"
          target="_blank"
          rel="noreferrer"
          className={cx(
            microphoneNoticeActionClass(compact),
            'border-white/10 bg-white/10 text-white/75 hover:bg-white/15 hover:text-white',
          )}
        >
          {copy.calls.microphoneHelp}
        </a>
      </div>
      <div
        className={cx(
          'mt-2 leading-snug text-white/35',
          compact ? 'text-[0.65rem]' : 'text-xs',
        )}
      >
        {copy.calls.microphoneTroubleshooting}
      </div>
    </div>
  );
}

function microphoneNoticeActionClass(compact: boolean): string {
  return cx(
    'inline-flex items-center justify-center rounded-xl border font-black leading-none transition',
    compact ? 'h-8 px-3 text-[0.7rem]' : 'h-9 px-4 text-xs',
  );
}

function microphoneErrorText(error: CallSession['microphoneError']): string {
  if (error === 'denied') return copy.calls.microphoneDenied;
  if (error === 'missing-device') return copy.calls.microphoneMissingDevice;
  if (error === 'in-use') return copy.calls.microphoneInUse;
  if (error === 'constraint') return copy.calls.microphoneConstraint;
  if (error === 'not-secure') return copy.calls.microphoneNotSecure;
  if (error === 'security') return copy.calls.microphoneSecurity;
  if (error === 'unsupported') return copy.calls.microphoneUnsupported;

  return copy.calls.microphoneUnknown;
}
