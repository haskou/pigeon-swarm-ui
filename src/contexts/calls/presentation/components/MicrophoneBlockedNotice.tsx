import type { CallSession } from '../view-models/CallSession';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { MicrophoneDevicePicker } from './MicrophoneDevicePicker';
import { microphoneErrorText } from './microphoneErrorText';
import { microphonePermissionHelpUrl } from './microphonePermissionHelpUrl';

const secondaryActionClass =
  'border-white/10 bg-white/10 text-white/75 hover:bg-white/15 hover:text-white';

function microphoneNoticeActionClass(compact: boolean): string {
  return cx(
    'inline-flex items-center justify-center rounded-xl border font-black leading-none transition',
    compact ? 'h-8 px-3 text-[0.7rem]' : 'h-9 px-4 text-xs',
  );
}

/**
 * A denial asks the browser again and links this browser's permission guide;
 * any other failure a new attempt can fix only retries.
 */
function MicrophoneNoticeActions({
  compact,
  denied,
  onRetryMicrophone,
}: {
  compact: boolean;
  denied: boolean;
  onRetryMicrophone: (deviceId?: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onRetryMicrophone()}
        className={cx(
          microphoneNoticeActionClass(compact),
          denied
            ? 'border-amber-100/60 bg-amber-100 text-amber-950 hover:bg-white'
            : secondaryActionClass,
        )}
      >
        {denied ? copy.calls.microphoneAllow : copy.calls.microphoneRetry}
      </button>
      {denied ? (
        <a
          href={microphonePermissionHelpUrl(navigator.userAgent)}
          target="_blank"
          rel="noreferrer"
          className={cx(
            microphoneNoticeActionClass(compact),
            secondaryActionClass,
          )}
        >
          {copy.calls.microphoneHelp}
        </a>
      ) : null}
    </div>
  );
}

/** Only a failure without a known cause gets the general checklist. */
function MicrophoneTroubleshootingHint({
  compact,
  error,
}: {
  compact: boolean;
  error: CallSession['microphoneError'];
}) {
  if (error !== 'security' && error !== 'unknown') return null;

  return (
    <div
      className={cx(
        'mt-2 leading-snug text-white/35',
        compact ? 'text-[0.65rem]' : 'text-xs',
      )}
    >
      {copy.calls.microphoneTroubleshooting}
    </div>
  );
}

/**
 * Each failure offers only the actions that can fix it: an insecure page or
 * a browser without capture offers none, and only an unexplained failure
 * adds the general troubleshooting hint.
 */
export function MicrophoneBlockedNotice({
  call,
  compact = false,
  onRetryMicrophone,
}: {
  call: CallSession;
  compact?: boolean;
  onRetryMicrophone: (deviceId?: string) => void;
}) {
  const error = call.microphoneError;
  const capturePossible = error !== 'not-secure' && error !== 'unsupported';

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
        {microphoneErrorText(error)}
      </div>
      {capturePossible ? (
        <>
          <MicrophoneNoticeActions
            compact={compact}
            denied={error === 'denied'}
            onRetryMicrophone={onRetryMicrophone}
          />
          <MicrophoneDevicePicker
            call={call}
            compact={compact}
            onRetryMicrophone={onRetryMicrophone}
          />
        </>
      ) : null}
      <MicrophoneTroubleshootingHint compact={compact} error={error} />
    </div>
  );
}
