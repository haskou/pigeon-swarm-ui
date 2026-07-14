import type { CallSession } from '../../domain/callSession.types';

import { DialogCloseButton } from '../../../../shared/presentation/components/DialogCloseButton';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useTechnicalDetailsPreference } from '../../../../shared/presentation/preferences/useTechnicalDetailsPreference';
import { SpeakerIcon } from './callIcons';
import { callSessionTitle } from './callSessionDisplay';
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
          <p className="truncate text-xs text-white/50 sm:text-sm">
            {subtitleText}
          </p>
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
