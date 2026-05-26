import type {
  CallParticipant,
  CallSession,
} from '../../domain/callSession.types';

import { cx } from '../../../../shared/presentation/cx';

export function CallParticipantMetrics({
  call,
  participant,
}: {
  call: CallSession;
  participant: CallParticipant;
}) {
  const latencyLabel =
    participant.latencyMs === undefined ? '-' : `${participant.latencyMs} ms`;
  const packetLossLabel =
    participant.packetsLost === undefined
      ? '-'
      : String(participant.packetsLost);

  return (
    <dl className="mt-2 grid w-full grid-cols-3 gap-1.5 text-left text-[0.58rem]">
      <Metric label="Status" value={callParticipantStatus(participant, call)} />
      <Metric label="Latency" value={latencyLabel} />
      <Metric label="Lost" value={packetLossLabel} />
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cx(
        'min-w-0 rounded-xl border border-white/8 bg-white/6 px-2 py-1.5',
      )}
    >
      <dt className="text-[0.55rem] font-black uppercase text-white/35">
        {label}
      </dt>
      <dd className="mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-black leading-tight text-white/85">
        {value}
      </dd>
    </div>
  );
}

function callParticipantStatus(
  participant: CallParticipant,
  call: CallSession,
): string {
  if (participant.identityId === call.currentIdentityId) return call.status;

  if (participant.connectionState) return participant.connectionState;

  if (participant.status) return participant.status;

  return call.status;
}
