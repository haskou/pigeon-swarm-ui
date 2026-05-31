import type { CallSession } from '../../domain/callSession.types';

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
        'rounded-2xl border border-amber-300/25 bg-amber-300/10 text-left',
        compact ? 'p-3' : 'w-full p-4',
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
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetryMicrophone}
          className={cx(
            'rounded-xl bg-amber-100 font-black text-amber-950 transition hover:bg-white',
            compact ? 'px-3 py-1.5 text-[0.7rem]' : 'px-4 py-2 text-xs',
          )}
        >
          {copy.calls.microphoneAllow}
        </button>
        <button
          type="button"
          onClick={onRetryMicrophone}
          className={cx(
            'rounded-xl bg-white/10 font-black text-white/75 transition hover:bg-white/15 hover:text-white',
            compact ? 'px-3 py-1.5 text-[0.7rem]' : 'px-4 py-2 text-xs',
          )}
        >
          {copy.calls.microphoneRetry}
        </button>
        <a
          href="https://support.google.com/chrome/answer/2693767"
          target="_blank"
          rel="noreferrer"
          className={cx(
            'rounded-xl bg-white/10 font-black text-white/75 transition hover:bg-white/15 hover:text-white',
            compact ? 'px-3 py-1.5 text-[0.7rem]' : 'px-4 py-2 text-xs',
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
