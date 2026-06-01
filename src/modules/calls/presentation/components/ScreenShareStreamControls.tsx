import { useMemo, useState } from 'react';

import type {
  CallParticipant,
  ScreenShareQualityPreset,
} from '../../domain/callSession.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import {
  screenShareQualityLabel,
  screenShareQualityPresets,
} from '../../infrastructure/media/ScreenShareQuality';
import { ScreenShareVolumeControl } from './ScreenShareVolumeControl';

export function ScreenShareStreamControls({
  className,
  onQualityChange,
  onVolumeChange,
  participant,
  quality,
  volumePercent,
}: {
  className?: string;
  onQualityChange: (quality: ScreenShareQualityPreset) => void;
  onVolumeChange: (volumePercent: number) => void;
  participant: CallParticipant;
  quality: ScreenShareQualityPreset;
  volumePercent: number;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const technicalDetails = useMemo(
    () => screenShareTechnicalDetails(participant, quality),
    [participant, quality],
  );

  return (
    <div className={cx('space-y-2', className)}>
      <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="min-w-0">
          <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/35">
            {copy.calls.screenShareQuality}
          </span>
          <select
            aria-label={copy.calls.screenShareQuality}
            value={quality}
            onChange={(event) =>
              onQualityChange(event.target.value as ScreenShareQualityPreset)
            }
            className="h-9 w-full rounded-xl border border-white/10 bg-white/8 px-3 text-xs font-black text-white outline-none transition hover:bg-white/12 focus:border-emerald-300/60"
          >
            {screenShareQualityPresets.map((preset) => (
              <option key={preset} value={preset} className="bg-[#151722]">
                {screenShareQualityLabel(preset)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setDetailsOpen((isOpen) => !isOpen)}
          className="h-9 self-end rounded-xl border border-white/10 bg-white/8 px-3 text-xs font-black text-white/75 transition hover:bg-white/14 hover:text-white"
        >
          {detailsOpen
            ? copy.calls.hideStreamDetails
            : copy.calls.viewStreamDetails}
        </button>
        <ScreenShareVolumeControl
          className="sm:col-span-2"
          placement="inline"
          onChange={onVolumeChange}
          value={volumePercent}
        />
      </div>
      {detailsOpen && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/25 p-2 text-xs sm:grid-cols-3">
          {technicalDetails.map((detail) => (
            <div
              key={detail.label}
              className="rounded-lg border border-white/8 bg-white/5 px-2 py-1.5"
            >
              <div className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-white/35">
                {detail.label}
              </div>
              <div className="mt-0.5 truncate font-black text-white/80">
                {detail.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function screenShareTechnicalDetails(
  participant: CallParticipant,
  quality: ScreenShareQualityPreset,
): Array<{ label: string; value: string }> {
  const videoTrack = participant.screenStream?.getVideoTracks()[0];
  const audioTrack = participant.screenStream?.getAudioTracks()[0];
  const settings = videoTrack?.getSettings();

  return [
    {
      label: copy.calls.streamPreset,
      value: screenShareQualityLabel(quality),
    },
    {
      label: copy.calls.streamResolution,
      value:
        settings?.width && settings.height
          ? `${settings.width}x${settings.height}`
          : '-',
    },
    {
      label: copy.calls.streamFrameRate,
      value: settings?.frameRate ? `${Math.round(settings.frameRate)} fps` : '-',
    },
    {
      label: copy.calls.streamDisplaySurface,
      value: settings?.displaySurface ?? '-',
    },
    {
      label: copy.calls.streamAudio,
      value: audioTrack ? copy.calls.streamAudioEnabled : copy.calls.streamAudioDisabled,
    },
    {
      label: copy.calls.streamBitrate,
      value: participant.bitrateKbps ? `${participant.bitrateKbps} kbps` : '-',
    },
    {
      label: copy.calls.streamCodec,
      value: participant.codec ?? '-',
    },
    {
      label: copy.calls.streamLatency,
      value: participant.latencyMs ? `${participant.latencyMs} ms` : '-',
    },
    {
      label: copy.calls.streamPacketLoss,
      value:
        participant.packetsLost === undefined
          ? '-'
          : String(participant.packetsLost),
    },
    {
      label: copy.calls.streamJitter,
      value: participant.jitterMs ? `${participant.jitterMs} ms` : '-',
    },
    {
      label: copy.calls.streamTransport,
      value: participant.transport ?? '-',
    },
    {
      label: copy.calls.streamIceState,
      value: participant.iceState ?? '-',
    },
  ];
}
