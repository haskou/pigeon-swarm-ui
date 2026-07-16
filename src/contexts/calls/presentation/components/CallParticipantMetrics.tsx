import { useState } from 'react';

import type {
  CallParticipant,
  CallSession,
} from '../../domain/callSession.types';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { useTechnicalDetailsPreference } from '../../../../shared/presentation/preferences/useTechnicalDetailsPreference';
import {
  callParticipantConnectionQuality,
  callParticipantConnectionStatus,
  type CallParticipantConnectionQuality as ParticipantConnectionQuality,
} from '../view-models/CallParticipantConnectionQuality';

export function CallParticipantMetrics({
  call,
  participant,
}: {
  call: CallSession;
  participant: CallParticipant;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [technicalDetailsVisible] = useTechnicalDetailsPreference();
  const quality = callParticipantConnectionQuality(participant, call);

  return (
    <div className="mt-2 w-full">
      <button
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        className="mx-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[0.65rem] font-black text-white/65 transition hover:bg-white/10 hover:text-white"
        aria-expanded={detailsOpen}
        title={copy.calls.connectionQuality}
      >
        <ConnectionQualityIcon quality={quality} />
        <span>{connectionQualityLabel(quality)}</span>
      </button>
      {detailsOpen && (
        <dl className="mt-2 w-full divide-y divide-white/10 border-y border-white/10 text-left text-[0.62rem]">
          <Metric
            label={copy.calls.callMetricLatency}
            value={formatMs(participant.latencyMs)}
          />
          {technicalDetailsVisible ? (
            <>
              <Metric
                label={copy.calls.callMetricPacketLoss}
                value={formatNumber(participant.packetsLost)}
              />
              <Metric
                label={copy.calls.callMetricJitter}
                value={formatMs(participant.jitterMs)}
              />
              <Metric
                label={copy.calls.callMetricCodec}
                value={participant.codec ?? '-'}
              />
              <Metric
                label={copy.calls.callMetricTransport}
                value={participant.transport ?? '-'}
              />
              <Metric
                label={copy.calls.callMetricPeerId}
                value={participant.identityId}
              />
              <Metric
                label={copy.calls.callMetricBitrate}
                value={
                  participant.bitrateKbps === undefined
                    ? '-'
                    : `${participant.bitrateKbps} kbps`
                }
              />
              <Metric
                label={copy.calls.callMetricIceState}
                value={participant.iceState ?? '-'}
              />
            </>
          ) : null}
          <Metric
            label={copy.calls.callMetricPath}
            value={connectionPathLabel(participant.connectionPath)}
          />
          <Metric
            label={copy.calls.callMetricStatus}
            value={callParticipantConnectionStatus(participant, call)}
          />
        </dl>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-[0.55rem] font-black uppercase text-white/35">
        {label}
      </dt>
      <dd className="max-w-[65%] overflow-hidden text-ellipsis whitespace-nowrap text-right font-black leading-tight text-white/85">
        {value}
      </dd>
    </div>
  );
}

function ConnectionQualityIcon({
  quality,
}: {
  quality: ParticipantConnectionQuality;
}) {
  const bars = quality === 'good' ? 3 : quality === 'weak' ? 2 : 1;

  return (
    <span
      className={cx(
        'flex h-4 items-end gap-0.5',
        quality === 'good'
          ? 'text-emerald-300'
          : quality === 'weak'
            ? 'text-amber-300'
            : quality === 'poor' || quality === 'disconnected'
              ? 'text-rose-300'
              : 'text-white/45',
      )}
      aria-hidden="true"
    >
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cx(
            'w-1 rounded-full bg-current',
            bar === 1 ? 'h-1.5' : bar === 2 ? 'h-2.5' : 'h-3.5',
            bar > bars && 'opacity-25',
            quality === 'connecting' && 'animate-pulse',
          )}
        />
      ))}
    </span>
  );
}

function connectionPathLabel(path?: 'direct' | 'relay' | 'unknown'): string {
  if (path === 'direct') return copy.calls.callMetricPathDirect;

  if (path === 'relay') return copy.calls.callMetricPathRelay;

  return '-';
}

function connectionQualityLabel(quality: ParticipantConnectionQuality): string {
  if (quality === 'good') return copy.calls.connectionQualityGood;

  if (quality === 'weak') return copy.calls.connectionQualityWeak;

  if (quality === 'poor') return copy.calls.connectionQualityPoor;

  if (quality === 'disconnected') {
    return copy.calls.connectionQualityDisconnected;
  }

  return copy.calls.connectionQualityConnecting;
}

function formatMs(value?: number): string {
  return value === undefined ? '-' : `${value} ms`;
}

function formatNumber(value?: number): string {
  return value === undefined ? '-' : String(value);
}
