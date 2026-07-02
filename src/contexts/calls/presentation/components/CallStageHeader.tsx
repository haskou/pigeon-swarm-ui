import type { CallSession } from '../../domain/callSession.types';

import { DialogCloseButton } from '../../../../shared/presentation/components/DialogCloseButton';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useTechnicalDetailsPreference } from '../../../../shared/presentation/preferences/useTechnicalDetailsPreference';
import { callSessionTitle } from './callSessionDisplay';
import { LockIcon, SpeakerIcon } from './callIcons';
import { MicrophoneBlockedNotice } from './MicrophoneBlockedNotice';

export function CallStageHeader({
  call,
  dataOpen,
  onClose,
  onDataToggle,
  onRetryMicrophone,
  subtitle,
}: {
  call: CallSession;
  dataOpen: boolean;
  onClose: () => void;
  onDataToggle: () => void;
  onRetryMicrophone: () => void;
  subtitle: string;
}) {
  const [technicalDetailsVisible] = useTechnicalDetailsPreference();
  const title = callSessionTitle(call);
  const participantCount = call.participants.length;
  const participantLabel =
    participantCount === 1
      ? copy.calls.oneParticipant
      : copy.calls.manyParticipants;
  const subtitleText =
    call.kind === 'community-voice'
      ? `${subtitle || copy.calls.voiceChannel} · ${participantCount} ${participantLabel}`
      : subtitle || copy.calls.waitingForParticipants;

  return (
    <header className="border-b border-white/10 p-2.5 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-200 sm:h-12 sm:w-12 sm:rounded-2xl">
          <SpeakerIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black text-white sm:text-xl">
            {title}
          </h2>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-xs text-white/50 sm:text-sm">
              {subtitleText}
            </p>
            <CallMediaEncryptionBadge call={call} />
          </div>
        </div>
        {technicalDetailsVisible ? (
          <button
            type="button"
            onClick={onDataToggle}
            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            {dataOpen ? copy.calls.hideCallData : copy.calls.viewCallData}
          </button>
        ) : null}
        <DialogCloseButton
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white sm:h-10 sm:w-10 sm:rounded-2xl"
          onClick={onClose}
        />
      </div>
      {!call.hasMicrophone && (
        <div className="mt-3">
          <MicrophoneBlockedNotice
            call={call}
            onRetryMicrophone={onRetryMicrophone}
          />
        </div>
      )}
    </header>
  );
}

function CallMediaEncryptionBadge({ call }: { call: CallSession }) {
  const active = call.mediaEncryption.active;

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-black',
        active
          ? 'border-emerald-300/35 bg-emerald-300/15 text-emerald-100'
          : 'border-amber-300/35 bg-amber-300/15 text-amber-100',
      )}
      title={mediaEncryptionLabel(call)}
    >
      <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">
        <LockIcon active={active} />
      </span>
      {active
        ? copy.calls.mediaEncryptionActive
        : copy.calls.mediaEncryptionDisabled}
    </span>
  );
}

function mediaEncryptionLabel(call: CallSession): string {
  if (call.mediaEncryption.active) return copy.calls.mediaEncryptionActive;

  if (call.mediaEncryption.reason === 'public-community') {
    return copy.calls.mediaEncryptionPublicCommunity;
  }

  if (call.mediaEncryption.reason === 'unsupported') {
    return copy.calls.mediaEncryptionUnsupported;
  }

  if (call.mediaEncryption.reason === 'missing-key') {
    return copy.calls.mediaEncryptionMissingKey;
  }

  return copy.calls.mediaEncryptionDisabled;
}
