import { useEffect, useState } from 'react';

import type { CallSession } from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { CallButton } from './CallButton';
import { CallDataPanel } from './CallDataPanel';
import {
  CameraIcon,
  HangUpIcon,
  HeadphonesIcon,
  MicrophoneIcon,
  ScreenShareIcon,
  SpeakerIcon,
} from './callIcons';
import { ParticipantTile } from './ParticipantTile';
import { VideoPreview } from './VideoPreview';

export function CallStageDialog({
  call,
  dataOpen,
  onClose,
  onDataToggle,
  onEnd,
  onParticipantVolumeChange,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleScreenShare,
  subtitle,
}: {
  call: CallSession;
  dataOpen: boolean;
  onClose: () => void;
  onDataToggle: () => void;
  onEnd: () => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
  subtitle: string;
}) {
  const [expandedScreen, setExpandedScreen] = useState<
    CallSession['participants'][number] | null
  >(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] bg-[#060712]/95 p-4 text-white backdrop-blur-xl sm:p-6"
      onClick={onClose}
    >
      <section
        className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <CallStageHeader
          call={call}
          dataOpen={dataOpen}
          onClose={onClose}
          onDataToggle={onDataToggle}
          subtitle={subtitle}
        />
        <CallStageBody
          call={call}
          dataOpen={dataOpen}
          onExpandScreen={setExpandedScreen}
          onParticipantVolumeChange={onParticipantVolumeChange}
          onToggleMute={onToggleMute}
        />
        <CallStageFooter
          call={call}
          onEnd={onEnd}
          onToggleCamera={onToggleCamera}
          onToggleDeafen={onToggleDeafen}
          onToggleMute={onToggleMute}
          onToggleScreenShare={onToggleScreenShare}
        />
      </section>
      {expandedScreen?.screenStream && (
        <ExpandedScreenShare
          participant={expandedScreen}
          onClose={() => setExpandedScreen(null)}
        />
      )}
    </div>
  );
}

function CallStageHeader({
  call,
  dataOpen,
  onClose,
  onDataToggle,
  subtitle,
}: {
  call: CallSession;
  dataOpen: boolean;
  onClose: () => void;
  onDataToggle: () => void;
  subtitle: string;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4 sm:p-5">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200">
        <SpeakerIcon />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-black text-white">{call.title}</h2>
        <p className="truncate text-sm text-white/50">
          {call.status === 'permission-denied'
            ? copy.calls.microphoneUnavailable
            : subtitle || copy.calls.waitingForParticipants}
        </p>
        {!call.hasMicrophone && (
          <p className="mt-1 text-xs font-bold text-amber-200/85">
            {copy.calls.microphoneUnavailable}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDataToggle}
        className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15"
      >
        {dataOpen ? 'Hide call data' : 'View call data'}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
        aria-label={copy.dialog.close}
      >
        x
      </button>
    </header>
  );
}

function CallStageBody({
  call,
  dataOpen,
  onExpandScreen,
  onParticipantVolumeChange,
  onToggleMute,
}: {
  call: CallSession;
  dataOpen: boolean;
  onExpandScreen: (participant: CallSession['participants'][number]) => void;
  onParticipantVolumeChange: (
    identityId: string,
    volumePercent: number,
  ) => void;
  onToggleMute: () => void;
}) {
  return (
    <div
      className={cx(
        'min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-5',
        dataOpen ? 'flex flex-col lg:flex-row' : 'flex',
      )}
    >
      <div className="flex min-h-full flex-1 flex-wrap content-center items-center justify-center gap-4">
        {call.participants.map((participant) => (
          <ParticipantTile
            key={participant.identityId}
            call={call}
            onExpandScreen={onExpandScreen}
            onParticipantVolumeChange={onParticipantVolumeChange}
            onToggleMute={onToggleMute}
            participant={participant}
          />
        ))}
      </div>
      {dataOpen && (
        <div className="min-h-0 w-full shrink-0 lg:h-full lg:w-[360px]">
          <CallDataPanel call={call} />
        </div>
      )}
    </div>
  );
}

function ExpandedScreenShare({
  onClose,
  participant,
}: {
  onClose: () => void;
  participant: CallSession['participants'][number];
}) {
  if (!participant.screenStream) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/95 p-4 text-white"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#05060b]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">
              {participant.name}
            </p>
            <p className="text-xs text-white/45">{copy.calls.screen}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label={copy.dialog.close}
          >
            x
          </button>
        </header>
        <div className="min-h-0 flex-1 bg-black">
          <VideoPreview
            fit="contain"
            label={`${copy.calls.screen} ${participant.name}`}
            muted
            stream={participant.screenStream}
          />
        </div>
      </div>
    </div>
  );
}

function CallStageFooter({
  call,
  onEnd,
  onToggleCamera,
  onToggleDeafen,
  onToggleMute,
  onToggleScreenShare,
}: {
  call: CallSession;
  onEnd: () => void;
  onToggleCamera: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
}) {
  return (
    <footer className="flex items-center justify-center gap-3 border-t border-white/10 p-4">
      <CallButton
        active={call.cameraEnabled}
        label={
          call.cameraEnabled ? copy.calls.disableCamera : copy.calls.camera
        }
        onClick={onToggleCamera}
      >
        <CameraIcon active={call.cameraEnabled} />
      </CallButton>
      <CallButton
        active={call.screenSharing}
        label={
          call.screenSharing
            ? copy.calls.stopScreenShare
            : copy.calls.shareScreen
        }
        onClick={onToggleScreenShare}
      >
        <ScreenShareIcon active={call.screenSharing} />
      </CallButton>
      <CallButton
        active={call.muted}
        disabled={!call.hasMicrophone}
        label={call.muted ? copy.calls.unmute : copy.calls.mute}
        onClick={onToggleMute}
      >
        <MicrophoneIcon muted={call.muted} />
      </CallButton>
      <CallButton
        active={call.deafened}
        label={call.deafened ? copy.calls.undeafen : copy.calls.deafen}
        onClick={onToggleDeafen}
      >
        <HeadphonesIcon deafened={call.deafened} />
      </CallButton>
      <button
        type="button"
        onClick={onEnd}
        className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-200/40 bg-rose-500 text-white shadow-lg shadow-rose-950/30 ring-2 ring-rose-500/20 transition hover:bg-rose-400 hover:ring-rose-300/35"
        aria-label={copy.calls.leave}
        title={copy.calls.leave}
      >
        <HangUpIcon />
      </button>
    </footer>
  );
}
